#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { convertMarkdown } from "./convert";
import { copyToClipboard } from "./clipboard";
import { listThemes } from "./theme";

function printHelp(): void {
  console.log(`
WeMD CLI — Convert Markdown to WeChat Official Account HTML

Usage:
  pnpm wemd convert <input.md> [options]

Options:
  --out <file>       Output HTML file path (default: stdout)
  --theme <id>       Theme ID (default: "default")
  --copy             Copy result to system clipboard
  --show-mac-bar     Show macOS-style window controls on code blocks
  --list-themes      List available theme IDs
  -h, --help         Show this help message

Examples:
  pnpm wemd convert article.md --out article.wechat.html
  pnpm wemd convert article.md --theme bauhaus --copy
  pnpm wemd convert article.md --theme cyberpunk-neon --out dist/output.html --copy
  pnpm wemd convert --list-themes
`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--list-themes")) {
    listThemes().forEach((id) => console.log(id));
    process.exit(0);
  }

  const subcommand = args[0];
  if (subcommand !== "convert") {
    console.error(`Unknown command "${subcommand}". Use "convert" or --help.`);
    process.exit(1);
  }

  const inputPath = args[1];
  if (!inputPath) {
    console.error("Missing input file. Usage: pnpm wemd convert <input.md> [options]");
    process.exit(1);
  }

  const resolvedPath = resolve(inputPath);
  if (!existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const outIndex = args.indexOf("--out");
  const outFile = outIndex >= 0 && outIndex + 1 < args.length ? args[outIndex + 1] : null;

  const themeIndex = args.indexOf("--theme");
  const theme = themeIndex >= 0 && themeIndex + 1 < args.length ? args[themeIndex + 1] : "default";

  const copy = args.includes("--copy");
  const showMacBar = args.includes("--show-mac-bar");

  let markdown: string;
  try {
    markdown = readFileSync(resolvedPath, "utf-8");
  } catch (err) {
    console.error(`Failed to read file: ${resolvedPath}`, err);
    process.exit(1);
  }

  if (!markdown.trim()) {
    console.warn("Warning: input file is empty. Output will be an empty HTML fragment.");
  }

  let html: string;
  try {
    html = convertMarkdown(markdown, { theme, showMacBar });
  } catch (err) {
    console.error("Conversion failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (outFile) {
    const outPath = resolve(outFile);
    try {
      writeFileSync(outPath, html, "utf-8");
      console.log(`Written to ${outPath}`);
    } catch (err) {
      console.error(`Failed to write output file: ${outPath}`, err);
      process.exit(1);
    }
  } else {
    process.stdout.write(html);
  }

  if (copy) {
    const ok = copyToClipboard(html);
    if (ok) {
      console.log("Copied to clipboard");
    } else {
      console.warn("Warning: clipboard copy not supported on this platform. Install xclip (Linux) or use a clipboard tool.");
    }
  }
}

main();
