import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

function toCFHtml(html: string): string {
  const EOL = "\r\n";
  const headerZero = `Version:0.9${EOL}StartHTML:0000000000${EOL}EndHTML:0000000000${EOL}StartFragment:0000000000${EOL}EndFragment:0000000000${EOL}`;
  const bodyPrefix = `<html>${EOL}<body>${EOL}<!--StartFragment-->`;
  const bodySuffix = `<!--EndFragment-->${EOL}</body>${EOL}</html>`;

  const startHtml = byteLen(headerZero);
  const startFragment = startHtml + byteLen(bodyPrefix);
  const endFragment = startFragment + byteLen(html);
  const endHtml = endFragment + byteLen(bodySuffix);

  const pad = (n: number) => String(n).padStart(10, "0");
  const header = `Version:0.9${EOL}StartHTML:${pad(startHtml)}${EOL}EndHTML:${pad(endHtml)}${EOL}StartFragment:${pad(startFragment)}${EOL}EndFragment:${pad(endFragment)}${EOL}`;

  return header + bodyPrefix + html + bodySuffix;
}

function copyWin32(html: string): boolean {
  const cfHtml = toCFHtml(html);
  const tmpFile = join(tmpdir(), `wemd-${Date.now()}.html`);
  try {
    writeFileSync(tmpFile, cfHtml, "utf-8");
    const script = `Add-Type -AssemblyName System.Windows.Forms;` +
      ` $html = Get-Content -Raw '${tmpFile.replace(/'/g, "''")}';` +
      ` [System.Windows.Forms.Clipboard]::SetText($html, [System.Windows.Forms.TextDataFormat]::Html)`;
    const r = spawnSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf-8", timeout: 15000 });
    if (r.status === 0) return true;
  } catch { /* fallthrough */ }
  finally { try { rmSync(tmpFile, { force: true }); } catch {} }
  try { const r = spawnSync("clip", { input: html, encoding: "utf-8" }); return r.status === 0; }
  catch { return false; }
}

function copyDarwin(html: string): boolean {
  const tmpFile = join(tmpdir(), `wemd-${Date.now()}.html`);
  try {
    writeFileSync(tmpFile, html, "utf-8");
    const script = `set htmlFile to POSIX file "${tmpFile.replace(/"/g, '\\"')}"\n` +
      `set htmlContent to read htmlFile as \u00abclass utf8\u00bb\n` +
      `set the clipboard to {\u00abclass HTML\u00bb:htmlContent}`;
    const r = spawnSync("osascript", ["-e", script], { encoding: "utf-8", timeout: 10000 });
    if (r.status === 0) return true;
  } catch { /* fallthrough */ }
  finally { try { rmSync(tmpFile, { force: true }); } catch {} }
  try { const r = spawnSync("pbcopy", { input: html, encoding: "utf-8" }); return r.status === 0; }
  catch { return false; }
}

function copyLinux(html: string): boolean {
  try {
    const r = spawnSync("wl-copy", ["--type", "text/html"], { input: html, encoding: "utf-8", timeout: 5000 });
    if (r.status === 0) return true;
  } catch { /* fallthrough */ }
  try {
    const r = spawnSync("xclip", ["-selection", "clipboard", "-t", "text/html"], { input: html, encoding: "utf-8", timeout: 5000 });
    if (r.status === 0) return true;
  } catch { /* fallthrough */ }
  try {
    const r = spawnSync("xclip", ["-selection", "clipboard"], { input: html, encoding: "utf-8" });
    return r.status === 0;
  } catch { return false; }
}

export function copyToClipboard(html: string): boolean {
  const platform = process.platform;
  if (platform === "win32") return copyWin32(html);
  if (platform === "darwin") return copyDarwin(html);
  if (platform === "linux") return copyLinux(html);
  return false;
}
