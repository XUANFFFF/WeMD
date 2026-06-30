import katex from "katex";
import { uploadEditorImage } from "./image/imageUploadFlow";
import { loadMathJax } from "../utils/mathJaxLoader";

const BOLD_ITALIC_UPPER_A = 0x1d468;
const BOLD_ITALIC_LOWER_A = 0x1d482;

// 微信移动预览可能忽略 img 的 width/style，PNG 兜底必须以目标显示尺寸生成。
const IMAGE_SCALE = 1;
// 先用更高分辨率渲染 SVG，再下采样到目标天然尺寸，减少 1x 直接栅格化的发虚。
const SVG_RASTER_SOURCE_SCALE = 2;
const EX_TO_PX = 8;
const EM_TO_PX = 16;
const MATHJAX_LOAD_TIMEOUT_MS = 4000;
const IMAGE_LOAD_TIMEOUT_MS = 3000;
const UPLOADED_IMAGE_LOAD_TIMEOUT_MS = 5000;
const BOLDSYMBOL_COMMAND = "\\boldsymbol";
const DEFAULT_FORMULA_IMAGE_BACKGROUND = "#ffffff";

const HIGH_RISK_MATH_PATTERNS = [
  /\\begin\b/,
  /\\(?:dfrac|tfrac|frac|sqrt|vec|hat|bar|tilde|overline|underline)\b/,
  /\\(?:partial|nabla|infty|pm|times)\b/,
  /[_^]/,
  /[=+\-<>]/,
];

interface MathImageRenderResult {
  imageCount: number;
}

type FormulaImageUploadCache = Map<string, Promise<string>>;
type FormulaImageFormat = "svg" | "png";

const toMathBoldItalicLatin = (value: string): string => {
  return Array.from(value)
    .map((char) => {
      const code = char.codePointAt(0);
      if (code === undefined) return char;
      if (code >= 65 && code <= 90) {
        return String.fromCodePoint(BOLD_ITALIC_UPPER_A + code - 65);
      }
      if (code >= 97 && code <= 122) {
        return String.fromCodePoint(BOLD_ITALIC_LOWER_A + code - 97);
      }
      return char;
    })
    .join("");
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const replaceBoldSymbolWithMathbf = (latex: string): string => {
  let output = "";
  let index = 0;

  while (index < latex.length) {
    const commandIndex = latex.indexOf(BOLDSYMBOL_COMMAND, index);
    if (commandIndex === -1) {
      output += latex.slice(index);
      break;
    }

    output += latex.slice(index, commandIndex);
    let cursor = commandIndex + BOLDSYMBOL_COMMAND.length;
    while (/\s/.test(latex[cursor] || "")) cursor += 1;

    if (latex[cursor] === "{") {
      let depth = 0;
      let end = cursor;
      for (; end < latex.length; end += 1) {
        const char = latex[end];
        if (char === "{") depth += 1;
        if (char === "}") {
          depth -= 1;
          if (depth === 0) {
            end += 1;
            break;
          }
        }
      }

      if (depth !== 0) {
        output += latex.slice(commandIndex);
        return output;
      }

      output += `\\mathbf{${latex.slice(cursor + 1, end - 1)}}`;
      index = end;
      continue;
    }

    if (latex[cursor] === "\\") {
      const commandMatch = latex.slice(cursor).match(/^\\[a-zA-Z]+|^\\./);
      if (commandMatch) {
        output += `\\mathbf{${commandMatch[0]}}`;
        index = cursor + commandMatch[0].length;
        continue;
      }
    }

    if (latex[cursor]) {
      output += `\\mathbf{${latex[cursor]}}`;
      index = cursor + 1;
      continue;
    }

    output += BOLDSYMBOL_COMMAND;
    index = cursor;
  }

  return output;
};

const getMathJaxLatexCandidates = (latex: string): string[] => {
  const mathbfLatex = replaceBoldSymbolWithMathbf(latex);
  return mathbfLatex === latex ? [latex] : [latex, mathbfLatex];
};

const normalizeBoldSymbolText = (container: HTMLElement): void => {
  container.querySelectorAll<HTMLElement>(".boldsymbol").forEach((node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent) return;
      child.textContent = toMathBoldItalicLatin(child.textContent);
    });
  });
};

const rerenderFormulaWithSafeKatex = (
  node: HTMLElement,
  latex: string,
  display: boolean,
): boolean => {
  const safeLatex = replaceBoldSymbolWithMathbf(latex);
  if (safeLatex === latex) return false;

  try {
    node.innerHTML = katex.renderToString(safeLatex, {
      displayMode: display,
      throwOnError: false,
    });
    return true;
  } catch (error) {
    console.warn("boldsymbol 安全 KaTeX 兜底失败，保留原公式 HTML", error);
    return false;
  }
};

const isHighRiskLatex = (latex: string, node: HTMLElement): boolean => {
  if (node.classList.contains("block-equation")) return true;
  if (node.querySelector(".katex-error")) return true;
  return HIGH_RISK_MATH_PATTERNS.some((pattern) => pattern.test(latex));
};

const parseSvgLengthToPx = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const match = value.trim().match(/^([\d.]+)\s*([a-z%]*)$/i);
  if (!match) return fallback;

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallback;

  const unit = match[2].toLowerCase();
  if (!unit || unit === "px") return amount;
  if (unit === "ex") return amount * EX_TO_PX;
  if (unit === "em") return amount * EM_TO_PX;
  if (unit === "pt") return amount * (4 / 3);
  return fallback;
};

const getSvgFallbackSize = (
  svg: SVGElement,
): { width: number; height: number } => {
  const viewBoxParts = (svg.getAttribute("viewBox") || "")
    .trim()
    .split(/\s+/)
    .map((token) => Number.parseFloat(token));
  const viewBoxWidth = Number.isFinite(viewBoxParts[2]) ? viewBoxParts[2] : 0;
  const viewBoxHeight = Number.isFinite(viewBoxParts[3]) ? viewBoxParts[3] : 0;
  const fallbackWidth =
    viewBoxWidth > 0 ? (viewBoxWidth / 1000) * EM_TO_PX : 160;
  const fallbackHeight =
    viewBoxHeight > 0 ? (viewBoxHeight / 1000) * EM_TO_PX : 48;

  return {
    width: parseSvgLengthToPx(svg.getAttribute("width"), fallbackWidth),
    height: parseSvgLengthToPx(svg.getAttribute("height"), fallbackHeight),
  };
};

const loadImageFromDataUrl = async (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("公式 SVG 转图片超时"));
    }, IMAGE_LOAD_TIMEOUT_MS);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timeoutId);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("公式 SVG 转图片失败"));
    };
    img.src = src;
  });
};

const waitForImageUrlReadable = async (src: string): Promise<void> => {
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("公式图片上传后暂不可访问"));
      img.src = src;
    }),
    UPLOADED_IMAGE_LOAD_TIMEOUT_MS,
    "公式图片加载超时",
  );
};

const createFormulaImageCacheKey = (
  latex: string,
  display: boolean,
  format: FormulaImageFormat,
): string => `${format}:${display ? "block" : "inline"}:${latex}`;

const hashFormulaKey = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
};

const canvasToPngBlob = async (canvas: HTMLCanvasElement): Promise<Blob> => {
  if (typeof canvas.toBlob === "function") {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (blob) return blob;
  }

  const response = await fetch(canvas.toDataURL("image/png"));
  return response.blob();
};

const isTransparentColor = (value: string): boolean => {
  const color = value.trim().toLowerCase();
  if (!color || color === "transparent") return true;

  const rgbaMatch = color.match(/^rgba?\(([^)]+)\)$/);
  if (!rgbaMatch) return false;

  const parts = rgbaMatch[1].split(",").map((part) => part.trim());
  if (parts.length < 4) return false;

  const alpha = Number.parseFloat(parts[3]);
  return Number.isFinite(alpha) && alpha <= 0;
};

const resolveFormulaImageBackground = (node: HTMLElement): string => {
  let current: HTMLElement | null = node;

  while (current && current !== document.body) {
    const backgroundColor = window.getComputedStyle(current).backgroundColor;
    if (!isTransparentColor(backgroundColor)) {
      return backgroundColor;
    }
    current = current.parentElement;
  }

  return DEFAULT_FORMULA_IMAGE_BACKGROUND;
};

const getSvgViewBoxRect = (
  svg: SVGElement,
  fallbackWidth: number,
  fallbackHeight: number,
): { x: number; y: number; width: number; height: number } => {
  const viewBoxParts = (svg.getAttribute("viewBox") || "")
    .trim()
    .split(/\s+/)
    .map((token) => Number.parseFloat(token));

  if (
    viewBoxParts.length === 4 &&
    viewBoxParts.every((value) => Number.isFinite(value)) &&
    viewBoxParts[2] > 0 &&
    viewBoxParts[3] > 0
  ) {
    return {
      x: viewBoxParts[0],
      y: viewBoxParts[1],
      width: viewBoxParts[2],
      height: viewBoxParts[3],
    };
  }

  return {
    x: 0,
    y: 0,
    width: fallbackWidth,
    height: fallbackHeight,
  };
};

const renderMathJaxContainer = (
  mathJax: NonNullable<Window["MathJax"]>,
  latex: string,
  display: boolean,
): HTMLElement => {
  let lastError: unknown;

  for (const candidate of getMathJaxLatexCandidates(latex)) {
    try {
      const container = mathJax.tex2svg?.(candidate, {
        display,
      }) as HTMLElement;
      if (
        container.textContent?.includes(BOLDSYMBOL_COMMAND) ||
        container.querySelector("mjx-merror, merror, [data-mjx-error]")
      ) {
        throw new Error("MathJax 输出包含未解析的 boldsymbol");
      }
      return container;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const renderSvgToPngBlob = async (
  svg: SVGElement,
  backgroundColor: string,
): Promise<{ blob: Blob; width: number; height: number }> => {
  const svgClone = svg.cloneNode(true) as SVGElement;
  const { width, height } = getSvgFallbackSize(svg);

  svgClone.setAttribute("width", String(width * SVG_RASTER_SOURCE_SCALE));
  svgClone.setAttribute("height", String(height * SVG_RASTER_SOURCE_SCALE));
  if (!svgClone.getAttribute("xmlns")) {
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const svgMarkup = new XMLSerializer().serializeToString(svgClone);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  const img = await loadImageFromDataUrl(svgDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * IMAGE_SCALE);
  canvas.height = Math.ceil(height * IMAGE_SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("公式 PNG 渲染失败");
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  ctx.scale(IMAGE_SCALE, IMAGE_SCALE);
  ctx.drawImage(img, 0, 0, width, height);

  return {
    blob: await canvasToPngBlob(canvas),
    width,
    height,
  };
};

const renderSvgToSvgBlob = (
  svg: SVGElement,
  backgroundColor: string,
): { blob: Blob; width: number; height: number } => {
  const svgClone = svg.cloneNode(true) as SVGElement;
  const { width, height } = getSvgFallbackSize(svg);
  const displayWidth = Math.ceil(width);
  const displayHeight = Math.ceil(height);

  svgClone.setAttribute("width", String(displayWidth));
  svgClone.setAttribute("height", String(displayHeight));
  if (!svgClone.getAttribute("viewBox")) {
    svgClone.setAttribute("viewBox", `0 0 ${displayWidth} ${displayHeight}`);
  }
  if (!svgClone.getAttribute("xmlns")) {
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  if (!isTransparentColor(backgroundColor)) {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const viewBoxRect = getSvgViewBoxRect(
      svgClone,
      displayWidth,
      displayHeight,
    );
    rect.setAttribute("x", String(viewBoxRect.x));
    rect.setAttribute("y", String(viewBoxRect.y));
    rect.setAttribute("width", String(viewBoxRect.width));
    rect.setAttribute("height", String(viewBoxRect.height));
    rect.setAttribute("class", "wemd-formula-bg");
    rect.setAttribute("fill", backgroundColor);
    svgClone.insertBefore(rect, svgClone.firstChild);
  }

  const svgMarkup = new XMLSerializer().serializeToString(svgClone);
  return {
    blob: new Blob([svgMarkup], {
      type: "image/svg+xml;charset=utf-8",
    }),
    width,
    height,
  };
};

const uploadFormulaImage = async (
  blob: Blob,
  latex: string,
  display: boolean,
  uploadCache: FormulaImageUploadCache,
  format: FormulaImageFormat,
): Promise<string> => {
  const key = createFormulaImageCacheKey(latex, display, format);
  const cached = uploadCache.get(key);
  if (cached) return cached;

  const mimeType = format === "svg" ? "image/svg+xml" : "image/png";
  const file = new File(
    [blob],
    `wemd-formula-${hashFormulaKey(key)}.${format}`,
    {
      type: mimeType,
    },
  );
  const uploadPromise = uploadEditorImage(file).then(async (result) => {
    await waitForImageUrlReadable(result.url);
    return result.url;
  });
  uploadCache.set(key, uploadPromise);

  try {
    return await uploadPromise;
  } catch (error) {
    uploadCache.delete(key);
    throw error;
  }
};

const createFormulaImageElement = (
  imageUrl: string,
  width: number,
  height: number,
  display: boolean,
): HTMLImageElement => {
  const img = document.createElement("img");
  const displayWidth = Math.ceil(width);
  const displayHeight = Math.ceil(height);
  img.src = imageUrl;
  img.alt = "公式";
  img.width = displayWidth;
  img.height = displayHeight;
  img.setAttribute("width", String(displayWidth));
  img.setAttribute("height", String(displayHeight));
  img.style.width = `${displayWidth}px`;
  img.style.height = `${displayHeight}px`;
  img.style.maxWidth = "100%";
  img.style.verticalAlign = display ? "middle" : "-0.15em";

  if (display) {
    img.style.display = "block";
    img.style.margin = "1em auto";
  } else {
    img.style.display = "inline-block";
  }

  return img;
};

const renderLatexToFormulaImage = async (
  latex: string,
  display: boolean,
  sourceNode: HTMLElement,
  uploadCache: FormulaImageUploadCache,
): Promise<HTMLImageElement | null> => {
  try {
    const mathJax = window.MathJax;
    if (!mathJax?.tex2svg) return null;

    if (typeof mathJax.texReset === "function") {
      mathJax.texReset();
    }
    const mathContainer = renderMathJaxContainer(mathJax, latex, display);
    const svg = mathContainer.querySelector("svg");
    if (!svg) return null;

    const backgroundColor = resolveFormulaImageBackground(sourceNode);
    try {
      const { blob, width, height } = renderSvgToSvgBlob(svg, backgroundColor);
      const imageUrl = await uploadFormulaImage(
        blob,
        latex,
        display,
        uploadCache,
        "svg",
      );
      return createFormulaImageElement(imageUrl, width, height, display);
    } catch (error) {
      console.warn("复杂公式转远程 SVG 失败，尝试 PNG 兜底", error);
    }

    const { blob, width, height } = await renderSvgToPngBlob(
      svg,
      backgroundColor,
    );
    const imageUrl = await uploadFormulaImage(
      blob,
      latex,
      display,
      uploadCache,
      "png",
    );
    return createFormulaImageElement(imageUrl, width, height, display);
  } catch (error) {
    console.warn("复杂公式转远程图片失败，保留 KaTeX HTML", error);
    return null;
  }
};

export const renderHighRiskMathAsImages = async (
  container: HTMLElement,
): Promise<MathImageRenderResult> => {
  const formulaNodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      ".inline-equation[data-latex], .block-equation[data-latex]",
    ),
  ).filter((node) => {
    const latex = node.getAttribute("data-latex") || "";
    return latex && isHighRiskLatex(latex, node);
  });

  let imageCount = 0;
  let canRenderImages = true;
  const uploadCache: FormulaImageUploadCache = new Map();

  try {
    await withTimeout(
      loadMathJax(),
      MATHJAX_LOAD_TIMEOUT_MS,
      "MathJax 加载超时",
    );
  } catch (error) {
    canRenderImages = false;
    console.warn("复杂公式图片化初始化失败，改用 KaTeX HTML 兜底", error);
  }

  const renderResults = await Promise.all(
    formulaNodes.map(async (node) => {
      const latex = node.getAttribute("data-latex") || "";
      const display = node.classList.contains("block-equation");
      const image = canRenderImages
        ? await renderLatexToFormulaImage(latex, display, node, uploadCache)
        : null;
      if (!image) {
        rerenderFormulaWithSafeKatex(node, latex, display);
        return false;
      }

      node.replaceChildren(image);
      node.removeAttribute("data-latex");
      return true;
    }),
  );

  imageCount = renderResults.filter(Boolean).length;

  return { imageCount };
};

/**
 * 微信复制公式兼容处理。
 * KaTeX 会输出隐藏 MathML 与 TeX annotation，微信清洗后可能暴露源码。
 */
export const stripHiddenMathMarkupForWechat = (
  container: HTMLElement,
): void => {
  container.querySelectorAll(".katex-mathml").forEach((node) => {
    node.remove();
  });

  container
    .querySelectorAll('annotation[encoding="application/x-tex"]')
    .forEach((node) => {
      node.remove();
    });

  container.querySelectorAll<HTMLElement>("[data-latex]").forEach((node) => {
    node.removeAttribute("data-latex");
  });

  normalizeBoldSymbolText(container);

  container
    .querySelectorAll<HTMLElement>(".katex, .katex-html, .base")
    .forEach((node) => {
      node.style.setProperty("white-space", "nowrap", "important");
    });

  container.querySelectorAll<HTMLElement>(".katex-html").forEach((node) => {
    node.style.setProperty("display", "inline-block", "important");
  });

  container.querySelectorAll<HTMLElement>(".base").forEach((node) => {
    node.style.setProperty("display", "inline-block", "important");
    node.style.setProperty("width", "auto", "important");
    node.style.setProperty("min-width", "0", "important");
  });
};
