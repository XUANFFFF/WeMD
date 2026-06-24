import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname, basename, resolve, dirname } from "node:path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 20 * 1024 * 1024;

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  prefix?: string;
}

export function readR2Config(): R2Config | null {
  if (process.env.WEMD_IMAGE_PROVIDER !== "r2") return null;
  const required = [
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET",
    "CLOUDFLARE_R2_PUBLIC_BASE_URL",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`R2 config missing: ${missing.join(", ")}`);
    return null;
  }
  return {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID!,
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    bucket: process.env.CLOUDFLARE_R2_BUCKET!,
    publicBaseUrl: process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL!.replace(/\/+$/, ""),
    prefix: process.env.CLOUDFLARE_R2_PREFIX || undefined,
  };
}

function getContentType(path: string): string {
  const ext = extname(path).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return map[ext] || "application/octet-stream";
}

export async function uploadToR2(imagePath: string, config: R2Config): Promise<{ url: string; key: string }> {
  const contentType = getContentType(imagePath);
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`Unsupported image type "${contentType}" for ${imagePath}. Allowed: ${ALLOWED_TYPES.join(", ")}`);
  }

  const buffer = readFileSync(imagePath);
  if (buffer.length > MAX_SIZE) {
    throw new Error(`Image too large: ${buffer.length} bytes (max ${MAX_SIZE})`);
  }

  const hash = createHash("md5").update(buffer).digest("hex").slice(0, 8);
  const safeName = basename(imagePath).replace(/[^a-zA-Z0-9._-]/g, "_");
  const now = new Date();
  const key = [
    config.prefix,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    `${hash}-${safeName}`,
  ]
    .filter(Boolean)
    .join("/");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return { url: `${config.publicBaseUrl}/${key}`, key };
}

export async function processHtmlImages(html: string, inputDir: string, config: R2Config): Promise<string> {
  const imgRegex = /(<img[^>]*\ssrc\s*=\s*["'])([^"']+)(["'][^>]*>)/gi;
  const matches: Array<{ prefix: string; src: string; suffix: string; absPath: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(html)) !== null) {
    const src = m[2];
    if (/^(https?:\/\/|data:)/i.test(src)) continue;
    const absPath = resolve(inputDir, src);
    if (!existsSync(absPath)) {
      console.warn(`Image not found, skipping: ${absPath}`);
      continue;
    }
    matches.push({ prefix: m[1], src: m[2], suffix: m[3], absPath });
  }

  if (matches.length === 0) return html;

  const results = await Promise.all(
    matches.map(async (match) => {
      const { url } = await uploadToR2(match.absPath, config);
      return { from: match.prefix + match.src + match.suffix, to: match.prefix + url + match.suffix };
    }),
  );

  let result = html;
  for (const r of results) {
    result = result.replace(r.from, r.to);
  }
  return result;
}
