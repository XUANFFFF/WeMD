import { describe, expect, it } from "vitest";
import { convertMarkdown } from "../convert";
import { getThemeCSS, listThemes } from "../theme";

describe("convertMarkdown", () => {
  it("converts basic markdown to HTML", () => {
    const html = convertMarkdown("# Hello\n\nThis is a paragraph.");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
    expect(html).toContain("This is a paragraph");
  });

  it("wraps output in #wemd section", () => {
    const html = convertMarkdown("Hello");
    expect(html).toContain('id="wemd"');
  });

  it("inlines CSS styles into HTML", () => {
    const html = convertMarkdown("# Title");
    // After juice inlining, h1 should have inline styles from the theme
    expect(html).toContain("style=");
    expect(html).toContain("font-size");
  });

  it("handles empty markdown", () => {
    const html = convertMarkdown("");
    expect(html).toContain('id="wemd"');
  });

  it("handles markdown with only whitespace", () => {
    const html = convertMarkdown("   \n\n  ");
    expect(html).toContain('id="wemd"');
  });

  it("converts checkboxes to emoji", () => {
    const html = convertMarkdown("- [ ] todo\n- [x] done");
    expect(html).not.toContain("<input");
    expect(html).toContain("⬜");
    expect(html).toContain("✅");
  });

  it("renders code blocks with syntax highlighting", () => {
    const html = convertMarkdown("```ts\nconst x = 1;\n```");
    expect(html).toContain('class="hljs"');
    expect(html).toContain("const");
  });

  it("renders tables", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const html = convertMarkdown(md);
    expect(html).toContain("<table");
    expect(html).toContain("<td");
  });
});

describe("theme support", () => {
  it("uses default theme when no theme specified", () => {
    const html = convertMarkdown("# Hello");
    expect(html).toContain("font-size");
  });

  it("lists available themes", () => {
    const themes = listThemes();
    expect(themes).toContain("default");
    expect(themes).toContain("bauhaus");
    expect(themes).toContain("cyberpunk-neon");
    expect(themes).length.greaterThan(5);
  });

  it("getThemeCSS returns CSS for valid theme", () => {
    const css = getThemeCSS("bauhaus");
    expect(css).toContain("#wemd");
    expect(css).toContain("font-size");
  });

  it("getThemeCSS throws for unknown theme", () => {
    expect(() => getThemeCSS("nonexistent")).toThrow("Unknown theme");
  });

  it("applies different themes with different output", () => {
    const defaultHtml = convertMarkdown("# Test", { theme: "default" });
    const bauhausHtml = convertMarkdown("# Test", { theme: "bauhaus" });
    // Different themes produce different CSS, so inline styles should differ
    expect(defaultHtml).not.toBe(bauhausHtml);
  });

  // ponytail: minimal coverage — verifies all built-in themes render without error
  for (const theme of listThemes()) {
    it(`renders with theme "${theme}"`, () => {
      const html = convertMarkdown("# Hello\n\nParagraph.\n\n- item", { theme });
      expect(html).toContain("Hello");
    });
  }
});
