import { spawnSync } from "node:child_process";

export function copyToClipboard(text: string): boolean {
  try {
    const platform = process.platform;
    if (platform === "darwin") {
      const r = spawnSync("pbcopy", { input: text, encoding: "utf-8" });
      return r.status === 0;
    }
    if (platform === "win32") {
      const r = spawnSync("clip", { input: text, encoding: "utf-8" });
      return r.status === 0;
    }
    if (platform === "linux") {
      const wl = spawnSync("wl-copy", { input: text, encoding: "utf-8" });
      if (wl.status === 0) return true;
      const x = spawnSync("xclip", ["-selection", "clipboard"], { input: text, encoding: "utf-8" });
      return x.status === 0;
    }
    return false;
  } catch {
    return false;
  }
}
