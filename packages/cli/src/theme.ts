import {
  basicTheme,
  codeGithubTheme,
  customDefaultTheme,
  academicPaperTheme,
  auroraGlassTheme,
  bauhausTheme,
  cyberpunkNeonTheme,
  knowledgeBaseTheme,
  luxuryGoldTheme,
  morandiForestTheme,
  neoBrutalismTheme,
  receiptTheme,
  sunsetFilmTheme,
  templateTheme,
} from "@wemd/core";

const themeRegistry: Record<string, string> = {
  default: basicTheme + "\n" + customDefaultTheme + "\n" + codeGithubTheme,
  "academic-paper": basicTheme + "\n" + academicPaperTheme + "\n" + codeGithubTheme,
  "aurora-glass": basicTheme + "\n" + auroraGlassTheme + "\n" + codeGithubTheme,
  bauhaus: basicTheme + "\n" + bauhausTheme + "\n" + codeGithubTheme,
  "cyberpunk-neon": basicTheme + "\n" + cyberpunkNeonTheme + "\n" + codeGithubTheme,
  "knowledge-base": basicTheme + "\n" + knowledgeBaseTheme + "\n" + codeGithubTheme,
  "luxury-gold": basicTheme + "\n" + luxuryGoldTheme + "\n" + codeGithubTheme,
  "morandi-forest": basicTheme + "\n" + morandiForestTheme + "\n" + codeGithubTheme,
  "neo-brutalism": basicTheme + "\n" + neoBrutalismTheme + "\n" + codeGithubTheme,
  receipt: basicTheme + "\n" + receiptTheme + "\n" + codeGithubTheme,
  "sunset-film": basicTheme + "\n" + sunsetFilmTheme + "\n" + codeGithubTheme,
  template: basicTheme + "\n" + templateTheme + "\n" + codeGithubTheme,
};

export function getThemeCSS(themeId: string): string {
  const css = themeRegistry[themeId];
  if (!css) {
    const available = Object.keys(themeRegistry).join(", ");
    throw new Error(`Unknown theme "${themeId}". Available themes: ${available}`);
  }
  return css;
}

export function listThemes(): string[] {
  return Object.keys(themeRegistry);
}
