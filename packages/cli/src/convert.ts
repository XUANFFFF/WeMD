import { createMarkdownParser, processHtml } from "@wemd/core";
import { getThemeCSS } from "./theme";

/**
 * Expand CSS var(--name) references in the CSS text with their declared values.
 * This is needed because WeChat strips CSS variables from the copied HTML.
 */
function expandCSSVariables(css: string): string {
  if (!css || !css.includes("var(")) return css;

  const vars = new Map<string, string>();
  const declRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = declRegex.exec(css)) !== null) {
    vars.set(match[1].trim(), match[2].trim());
  }

  if (vars.size === 0) return css;

  const resolveVar = (value: string, resolving: Set<string>): string => {
    let result = "";
    let cursor = 0;
    while (cursor < value.length) {
      const varIdx = value.indexOf("var(", cursor);
      if (varIdx < 0) { result += value.slice(cursor); break; }
      result += value.slice(cursor, varIdx);
      const openParen = varIdx + 3;
      let depth = 1;
      let closeIdx = -1;
      for (let i = openParen + 1; i < value.length; i++) {
        if (value[i] === "(") depth++;
        if (value[i] === ")") { depth--; if (depth === 0) { closeIdx = i; break; } }
      }
      if (closeIdx < 0) { result += value.slice(varIdx); break; }
      const rawArgs = value.slice(openParen + 1, closeIdx);
      const commaIdx = rawArgs.indexOf(",");
      const varName = (commaIdx >= 0 ? rawArgs.slice(0, commaIdx) : rawArgs).trim();
      const fallback = commaIdx >= 0 ? rawArgs.slice(commaIdx + 1).trim() : undefined;

      let replacement: string | null = null;
      if (varName.startsWith("--") && !resolving.has(varName)) {
        const varValue = vars.get(varName);
        if (varValue !== undefined) {
          const nextResolving = new Set(resolving);
          nextResolving.add(varName);
          replacement = resolveVar(varValue, nextResolving);
        } else if (fallback) {
          replacement = resolveVar(fallback, new Set(resolving));
        }
      } else if (fallback) {
        replacement = resolveVar(fallback, new Set(resolving));
      }
      result += replacement ?? `var(${rawArgs})`;
      cursor = closeIdx + 1;
    }
    return result;
  };

  const resolved = resolveVar(css, new Set());

  // Strip --custom-property declarations since WeChat doesn't support them
  return resolved.replace(/([^{}]*)\{([^{}]*)\}/gs, (_m: string, sel: string, body: string) => {
    const lines = body.split(";").map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith("--"));
    return lines.length === 0 ? "" : `${sel.trim()} { ${lines.join("; ")}; }`;
  });
}

/**
 * Strip CSS ::before / ::after rules that use counters(), since
 * counter content depends on DOM state at render time.
 */
function stripCounterPseudoRules(css: string): string {
  if (!css) return css;
  return css.replace(
    /([^{}]+?):{1,2}(before|after)\s*\{([^{}]*)\}/gi,
    (full: string, _sel: string, _pseudo: string, body: string) =>
      /content\s*:[^;{}]*\bcounters?\s*\(/i.test(body || "") ? "" : full,
  );
}

/**
 * Convert <input type="checkbox"> to emoji for WeChat compatibility.
 */
function convertCheckboxesToEmoji(html: string): string {
  const checked = html.replace(/<input[^>]*checked[^>]*>/gi, "✅\u00A0");
  return checked.replace(/<input[^>]*type=["']checkbox["'][^>]*>/gi, "⬜\u00A0");
}

export interface ConvertOptions {
  theme?: string;
  showMacBar?: boolean;
}

export function convertMarkdown(markdown: string, options: ConvertOptions = {}): string {
  const themeId = options.theme || "default";
  const showMacBar = options.showMacBar === true;

  const parser = createMarkdownParser({ showMacBar });
  const rawHtml = parser.render(markdown);

  const css = getThemeCSS(themeId);
  const expandedCss = expandCSSVariables(css);
  const sanitizedCss = stripCounterPseudoRules(expandedCss);

  const styledHtml = processHtml(rawHtml || "\n", sanitizedCss, true, true);

  return convertCheckboxesToEmoji(styledHtml);
}
