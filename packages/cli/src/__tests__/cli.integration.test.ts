import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(__dirname, "..", "..", "dist", "index.js");

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "wemd-cli-test-"));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function run(args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync("node", [CLI, ...args], { encoding: "utf-8", timeout: 30000 });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

function writeInput(content: string): string {
  const p = join(tmpDir, "input.md");
  writeFileSync(p, content, "utf-8");
  return p;
}

describe("CLI: --help", () => {
  it("shows help with -h", () => {
    const r = run(["-h"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("WeMD CLI");
  });

  it("shows help with --help", () => {
    const r = run(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("WeMD CLI");
  });

  it("shows help with no args", () => {
    const r = run([]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("WeMD CLI");
  });
});

describe("CLI: --list-themes", () => {
  it("lists all themes", () => {
    const r = run(["--list-themes"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("default");
    expect(r.stdout).toContain("bauhaus");
    expect(r.stdout).toContain("cyberpunk-neon");
    // ponytail: spot-check a few, not all 12
  });
});

describe("CLI: convert", () => {
  it("outputs HTML to stdout when no --out specified", () => {
    const input = writeInput("# Hello\n\nWorld.");
    const r = run(["convert", input]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Hello");
    expect(r.stdout).toContain('id="wemd"');
  });

  it("writes HTML to file with --out", () => {
    const input = writeInput("# Hello");
    const outFile = join(tmpDir, "output.html");
    const r = run(["convert", input, "--out", outFile]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Written to");
    expect(existsSync(outFile)).toBe(true);
    const content = readFileSync(outFile, "utf-8");
    expect(content).toContain("Hello");
  });

  it("accepts --theme option", () => {
    const input = writeInput("# Hello");
    const r = run(["convert", input, "--theme", "bauhaus"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Hello");
  });

  it("outputs different CSS for different themes", () => {
    const input = writeInput("# Hello");
    const defaultR = run(["convert", input, "--theme", "default"]);
    const bauhausR = run(["convert", input, "--theme", "bauhaus"]);
    expect(defaultR.stdout).not.toBe(bauhausR.stdout);
  });

  it("rejects unknown theme with clear error", () => {
    const input = writeInput("# Hello");
    const r = run(["convert", input, "--theme", "nonexistent"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Unknown theme");
    expect(r.stderr).toContain("nonexistent");
  });

  it("rejects missing input file with clear error", () => {
    const r = run(["convert", "/nonexistent/path.md"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("File not found");
  });

  it("rejects missing input argument", () => {
    const r = run(["convert"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Missing input file");
  });

  it("rejects unknown subcommand", () => {
    const r = run(["unknown"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Unknown command "unknown"');
  });

  it("handles empty markdown file gracefully", () => {
    const input = writeInput("");
    const r = run(["convert", input]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('id="wemd"');
  });

  it("handles whitespace-only file gracefully", () => {
    const input = writeInput("   \n\n  ");
    const r = run(["convert", input]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('id="wemd"');
  });

  it("supports --show-mac-bar flag", () => {
    const input = writeInput("```ts\nconst x = 1;\n```");
    const r = run(["convert", input, "--show-mac-bar"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("mac-sign");
  });

  it("warns on empty input", () => {
    const input = writeInput("");
    const r = run(["convert", input]);
    expect(r.stderr).toContain("empty");
  });

  it("fails when --out path is unwritable", () => {
    const input = writeInput("hello");
    const r = run(["convert", input, "--out", join(tmpDir, "nonexistent", "out.html")]);
    expect(r.status).toBe(1);
  });
});

describe("CLI: --copy", () => {
  it("handles --copy gracefully on this platform", () => {
    const input = writeInput("Hello");
    const r = run(["convert", input, "--copy"]);
    // --copy may succeed or warn, but never crash
    expect(r.status).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
  });
});
