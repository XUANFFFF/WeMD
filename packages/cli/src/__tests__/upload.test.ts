import { vi, describe, expect, it, beforeEach, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ponytail: mock S3Client with mutable send ref (vi.mock is hoisted, so use vi.hoisted)
const mockSendRef = vi.hoisted(() => ({ current: vi.fn().mockResolvedValue({}) }));

vi.mock("@aws-sdk/client-s3", () => {
  class MockS3Client {
    send = mockSendRef.current;
  }
  return { S3Client: MockS3Client, PutObjectCommand: vi.fn() };
});

import { readR2Config, uploadToR2, processHtmlImages } from "../upload";

describe("readR2Config", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.WEMD_IMAGE_PROVIDER;
    delete process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    delete process.env.CLOUDFLARE_R2_BUCKET;
    delete process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
    delete process.env.CLOUDFLARE_R2_PREFIX;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns null when WEMD_IMAGE_PROVIDER is not r2", () => {
    expect(readR2Config()).toBeNull();
  });

  it("returns null when required env vars are missing", () => {
    process.env.WEMD_IMAGE_PROVIDER = "r2";
    expect(readR2Config()).toBeNull();
  });

  it("returns config when all required vars are set", () => {
    process.env.WEMD_IMAGE_PROVIDER = "r2";
    process.env.CLOUDFLARE_R2_ACCOUNT_ID = "abc123";
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "key";
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "secret";
    process.env.CLOUDFLARE_R2_BUCKET = "my-bucket";
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL = "https://img.example.com/";
    const cfg = readR2Config();
    expect(cfg).not.toBeNull();
    expect(cfg!.accountId).toBe("abc123");
    expect(cfg!.publicBaseUrl).toBe("https://img.example.com");
    expect(cfg!.prefix).toBeUndefined();
  });

  it("includes optional prefix and strips trailing slash from base URL", () => {
    process.env.WEMD_IMAGE_PROVIDER = "r2";
    process.env.CLOUDFLARE_R2_ACCOUNT_ID = "a";
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "k";
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "s";
    process.env.CLOUDFLARE_R2_BUCKET = "b";
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL = "https://img.example.com/";
    process.env.CLOUDFLARE_R2_PREFIX = "wemd";
    const cfg = readR2Config();
    expect(cfg!.prefix).toBe("wemd");
    expect(cfg!.publicBaseUrl).toBe("https://img.example.com");
  });
});

describe("uploadToR2", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "wemd-upload-test-"));
    mockSendRef.current = vi.fn().mockResolvedValue({});
  });

  afterAll(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  const config = {
    accountId: "a",
    accessKeyId: "k",
    secretAccessKey: "s",
    bucket: "b",
    publicBaseUrl: "https://img.example.com",
    prefix: "wemd",
  };

  it("uploads a PNG and returns public URL", async () => {
    const img = join(tmpDir, "test.png");
    writeFileSync(img, Buffer.alloc(64));
    mockSendRef.current = vi.fn().mockResolvedValue({});
    const result = await uploadToR2(img, config);
    expect(result.url).toMatch(/^https:\/\/img\.example\.com\/wemd\/\d{4}\/\d{2}\//);
    expect(result.key).toMatch(/^wemd\/\d{4}\/\d{2}\//);
    expect(result.url).toContain("test.png");
    expect(mockSendRef.current).toHaveBeenCalledOnce();
  });

  it("rejects unsupported file type", async () => {
    const img = join(tmpDir, "test.svg");
    writeFileSync(img, "<svg></svg>");
    await expect(uploadToR2(img, config)).rejects.toThrow("Unsupported image type");
  });

  it("rejects oversized file", async () => {
    const img = join(tmpDir, "test.png");
    writeFileSync(img, Buffer.alloc(21 * 1024 * 1024));
    await expect(uploadToR2(img, config)).rejects.toThrow("Image too large");
  });
});

describe("processHtmlImages", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "wemd-process-test-"));
    mockSendRef.current = vi.fn().mockResolvedValue({});
  });

  afterAll(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  const config = {
    accountId: "a",
    accessKeyId: "k",
    secretAccessKey: "s",
    bucket: "b",
    publicBaseUrl: "https://img.example.com",
    prefix: "wemd",
  };

  it("uploads local images and replaces src in HTML", async () => {
    writeFileSync(join(tmpDir, "img.png"), Buffer.alloc(64));
    const html = '<p><img src="img.png" alt="test" /></p>';
    const result = await processHtmlImages(html, tmpDir, config);
    expect(result).toMatch(/src="https:\/\/img\.example\.com\/wemd\/\d{4}\/\d{2}\//);
    expect(mockSendRef.current).toHaveBeenCalledOnce();
  });

  it("skips http/https URLs", async () => {
    const html = '<p><img src="https://example.com/img.png" /></p>';
    const result = await processHtmlImages(html, tmpDir, config);
    expect(result).toBe(html);
    expect(mockSendRef.current).not.toHaveBeenCalled();
  });

  it("skips data URLs", async () => {
    const html = '<p><img src="data:image/png;base64,abc" /></p>';
    const result = await processHtmlImages(html, tmpDir, config);
    expect(result).toBe(html);
    expect(mockSendRef.current).not.toHaveBeenCalled();
  });

  it("skips missing local files with a warning", async () => {
    const html = '<p><img src="nonexistent.png" /></p>';
    const result = await processHtmlImages(html, tmpDir, config);
    expect(result).toBe(html);
    expect(mockSendRef.current).not.toHaveBeenCalled();
  });

  it("handles HTML with no images", async () => {
    const html = "<p>Hello</p>";
    const result = await processHtmlImages(html, tmpDir, config);
    expect(result).toBe(html);
  });
});
