import { App, Component, sanitizeHTMLToDom } from "obsidian";
import { PAGE_HEIGHTS, getContentHeight, getPagePaddingBottom, getPagePaddingH, getPagePaddingTop, getPageWidth, type PageMode } from "./constants";
import { applyPageEffects, deriveCoverStrokePalette, detectThemeBrightness, extractThemeColorValues } from "./effects";
import { paginateBody } from "./paginator";
import { parseNoteStructure } from "./parser";
import { renderMarkdownToHtml, createVaultImageResolver } from "./md-to-html";
import { buildCoverConfig, type RenderOptions } from "./schema";

export type { RenderOptions };

export interface RenderedPages {
  pages: HTMLElement[];
  cleanup: () => void;
  hasCoverImage: boolean;
}

function extractCoverImageSrc(
  coverImageMarkdown: string | null,
  resolveImage: (name: string, sourcePath?: string) => string,
  sourcePath: string,
): string | null {
  if (!coverImageMarkdown) return null;
  const imgHtml = renderMarkdownToHtml(coverImageMarkdown, (name) => resolveImage(name, sourcePath));
  const imgMatch = imgHtml.match(/src="([^"]+)"/);
  return imgMatch?.[1] ?? null;
}

export async function renderNote(
  app: App,
  markdown: string,
  sourcePath: string,
  themeCss: string,
  themeName: string,
  parentComponent: Component,
  options: RenderOptions
): Promise<RenderedPages> {
  const structure = parseNoteStructure(markdown);
  const cleanups: (() => void)[] = [];
  const resolveImage = createVaultImageResolver(app);
  const pageMode = options.pageMode as PageMode;
  const pageWidth = getPageWidth(pageMode);
  const pageHeight = PAGE_HEIGHTS[pageMode];
  const pagePaddingH = getPagePaddingH(pageMode);
  const pagePaddingTop = getPagePaddingTop(pageMode);
  const pagePaddingBottom = getPagePaddingBottom(pageMode);
  const pageRadius = Math.max(8, Math.round(pageWidth * 16 / 1200));
  const blockRadius = Math.max(4, Math.round(pageWidth * 8 / 1200));
  const quoteBorderWidth = Math.max(3, Math.round(pageWidth * 6 / 1200));
  const quotePaddingY = Math.max(4, Math.round(pageHeight * 8 / 1600));
  const quotePaddingLeft = Math.max(12, Math.round(pageWidth * 24 / 1200));
  const quoteMarginY = Math.max(8, Math.round(pageHeight * 20 / 1600));
  const listIndent = Math.max(20, Math.round(pageWidth * 40 / 1200));
  const listMarginBottom = Math.max(12, Math.round(pageHeight * 24 / 1600));
  const listItemMarginBottom = Math.max(4, Math.round(pageHeight * 8 / 1600));
  const inlineCodePaddingY = Math.max(1, Math.round(pageHeight * 2 / 1600));
  const inlineCodePaddingX = Math.max(4, Math.round(pageWidth * 8 / 1200));
  const blockPadding = Math.max(12, Math.round(pageWidth * 24 / 1200));
  const blockMarginY = Math.max(8, Math.round(pageHeight * 16 / 1600));
  const contentHeight = getContentHeight(pageMode);
  const cover = buildCoverConfig(options);
  const coverHorizontalPadding = Math.max(0, Math.min(pageWidth / 2, cover.position.paddingX));

  const coverFont = cover.typography.fontFamily;
  const coverColor = cover.typography.color;
  const strokePalette = deriveCoverStrokePalette(themeCss, themeName);
  const themeTitleColor = strokePalette.fill || "#e8c36a";

  // Build full CSS: theme + font overrides
  const coverColorCss = coverColor ? `
.nr-page-cover .nr-cover-content h1,
.nr-page-cover .nr-cover-content p { color: ${coverColor}; }
.nr-page-cover .nr-cover-content::before { background: ${coverColor}; }
` : "";
  const textAlign = cover.typography.align;
  const alignItems = textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start";
  const fontOverrideCss = `
.nr-page {
  font-size: ${options.fontSize}px;
  font-family: ${options.fontFamily};
  line-height: 1.75;
  letter-spacing: 0.05em;
}
.nr-page-cover .nr-cover-content {
  font-family: ${coverFont};
  font-weight: ${cover.typography.weight};
  align-items: ${alignItems};
  text-align: ${textAlign};
}
.nr-page-cover .nr-cover-content h1,
.nr-page-cover .nr-cover-content h2,
.nr-page-cover .nr-cover-content h3,
.nr-page-cover .nr-cover-content p {
  font-weight: ${cover.typography.weight};
}
${coverColorCss}
`;
  const pageCss = `
.nr-page {
  width: ${pageWidth}px;
  --nr-page-radius: ${pageRadius}px;
  --nr-block-radius: ${blockRadius}px;
  --nr-quote-border-width: ${quoteBorderWidth}px;
  --nr-quote-padding-y: ${quotePaddingY}px;
  --nr-quote-padding-left: ${quotePaddingLeft}px;
  --nr-quote-margin-y: ${quoteMarginY}px;
  --nr-list-indent: ${listIndent}px;
  --nr-list-margin-bottom: ${listMarginBottom}px;
  --nr-list-item-margin-bottom: ${listItemMarginBottom}px;
  --nr-inline-code-padding-y: ${inlineCodePaddingY}px;
  --nr-inline-code-padding-x: ${inlineCodePaddingX}px;
  --nr-block-padding: ${blockPadding}px;
  --nr-block-margin-y: ${blockMarginY}px;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}
.nr-page-cover, .nr-page-body {
  height: ${pageHeight}px;
  padding: ${pagePaddingTop}px ${pagePaddingH}px ${pagePaddingBottom}px;
}
.nr-page-cover {
  padding-left: ${coverHorizontalPadding}px;
  padding-right: ${coverHorizontalPadding}px;
}
.nr-page-body .nr-page-content {
  height: ${contentHeight}px;
  overflow: hidden;
  position: relative;
  z-index: 2;
}
.nr-page-content mark {
  background: linear-gradient(to top, rgba(255, 232, 102, 0.75) 55%, transparent 55%);
  color: inherit;
  padding: 0 4px;
  border-radius: 4px;
}
.nr-page-full {
  height: ${pageHeight}px;
  padding: 0;
}
.nr-cover-bg-image {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  border-radius: var(--nr-page-radius);
  z-index: 0;
}
.nr-page-cover .nr-cover-content {
  position: relative;
  z-index: 3;
}
.nr-cover-has-image .nr-cover-content {
  padding: ${pagePaddingTop}px ${coverHorizontalPadding}px ${pagePaddingBottom}px;
}
.nr-cover-has-image { padding: 0; }
.nr-full-page-img {
  width: 100%;
  height: 100%;
  display: block;
}
.nr-full-page-img.nr-full-cover { object-fit: cover; }
.nr-full-page-img:not(.nr-full-cover) { object-fit: contain; }
.nr-effect-overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 1;
}
`;
  // Capsule list style: each li becomes a rounded card
  const capsuleCss = options.listStyle === "capsule" ? (() => {
    const isDark = detectThemeBrightness(themeCss, themeName);
    const bg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
    const border = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
    return `
.nr-page-content ul,
.nr-page-content ol {
  padding-left: 0;
  list-style: none;
}
.nr-page-content li {
  background: ${bg};
  border: 1px solid ${border};
  border-radius: var(--nr-page-radius);
  padding: ${Math.max(10, Math.round(pageHeight * 20 / 1600))}px ${Math.max(14, Math.round(pageWidth * 28 / 1200))}px;
  margin-bottom: var(--nr-block-margin-y);
}
`;
  })() : "";
  const pages: HTMLElement[] = [];

  // --- Cover page ---
  const strokePercent = cover.stroke.inner.widthPercent / 100;
  const coverImageSrc = extractCoverImageSrc(structure.coverImageMarkdown, resolveImage, sourcePath);
  const hasCoverImage = coverImageSrc !== null;
  const themeHighlight = extractThemeColorValues(themeCss, themeName).highlight;
  const coverMarkCss = `
.nr-page-cover .nr-cover-content mark {
  ${buildCoverMarkCss(options, coverColor || themeTitleColor, themeHighlight, themeName, hasCoverImage)}
}
`;
  const fullCss = themeCss + fontOverrideCss + capsuleCss + pageCss + coverMarkCss;
  const coverTextOpts: CoverTextOptions = {
    strokePercent,
    fontScale: cover.typography.scale,
    letterSpacing: cover.typography.letterSpacing,
    lineHeight: cover.typography.lineHeight,
    availableWidth: Math.max(240, pageWidth - coverHorizontalPadding * 2),
    fontFamily: coverFont,
    fontWeight: cover.typography.weight,
  };
  let coverPage: HTMLElement;
  if (structure.coverMarkdown) {
    coverPage = buildRichCoverPage(structure.coverMarkdown, fullCss, resolveImage, sourcePath, pageWidth, pageHeight, coverTextOpts);
  } else {
    coverPage = buildTitleCoverPage(structure.title, fullCss, pageWidth, pageHeight, coverTextOpts);
  }

  // Apply effects to cover text (works with or without cover image)
  {
    const strokeStyle = cover.stroke.style;
    const hasGlow = cover.glow.enabled;
    const hasShadow = cover.shadow.enabled;
    const shadowBlur = cover.shadow.blur;
    const shadowOffX = cover.shadow.offsetX;
    const shadowOffY = cover.shadow.offsetY;
    const allCoverText = coverPage.querySelectorAll(".nr-cover-content p, .nr-cover-content h1, .nr-cover-content h2, .nr-cover-content h3, .nr-cover-content div");
    for (const el of allCoverText) {
      const htmlEl = el as HTMLElement;
      const fs = parseInt(htmlEl.style.fontSize) || 120;
      const sw = Math.max(1, Math.round(fs * strokePercent));
      const accentColor = htmlEl.style.color || coverColor || themeTitleColor;
      const textOpacity = Math.max(0, Math.min(1, cover.typography.opacity / 100));
      const strokeColor = withAlpha(cover.stroke.inner.color || strokePalette.inner, cover.stroke.opacity);
      const doubleStrokeExtra = Math.max(0, Math.round(fs * (cover.stroke.outer.widthPercent / 100)));
      const doubleStrokeWidth = sw + doubleStrokeExtra;
      const doubleStrokeColor = cover.stroke.outer.color || strokePalette.outer;
      const glowColor = cover.glow.color || accentColor;
      const shadowColor = cover.shadow.color;

    const hasInlineColor = htmlEl.style.color && htmlEl.style.color !== "";
    const textColor = coverColor || themeTitleColor;
    let css = hasInlineColor ? ";" : `; color: ${textColor} !important;`;
    const glowMul = cover.glow.size / 100;
    const textShadows: string[] = [];
    let bannerPadding: string | null = null;
    let bannerClipPath: string | null = null;
      switch (strokeStyle) {
        case "none":
          break;
        case "stroke": {
          const innerStrokeWidth = Math.max(1, Math.round(sw * 0.45));
          css += ` -webkit-text-stroke: ${innerStrokeWidth}px ${strokeColor}; paint-order: stroke fill;`;
          const clone = ensureOutlineBackdrop(htmlEl, sw, strokeColor, textOpacity);
          if (clone) {
            applyUnderlineScale(clone, fs, { overrideColor: strokeColor });
          }
          break;
        }
        case "double": {
          css += ` -webkit-text-stroke: ${sw}px ${strokeColor}; paint-order: stroke fill;`;
          const clone = ensureDoubleStrokeBackdrop(htmlEl, doubleStrokeWidth, doubleStrokeColor, textOpacity);
          if (clone) {
            applyUnderlineScale(clone, fs, { overrideColor: doubleStrokeColor });
          }
          break;
        }
        case "hollow": {
          css = "; color: transparent !important; -webkit-text-fill-color: transparent;";
          const clone = ensureOutlineBackdrop(htmlEl, sw, strokeColor, textOpacity);
          if (clone) {
            clone.setCssStyles({
              color: "transparent",
              webkitTextFillColor: "transparent",
            });
            applyUnderlineScale(clone, fs, { overrideColor: strokeColor });
          }
          break;
        }
      }

      if (hasGlow) {
        const gs = Math.max(1, Math.round(sw * glowMul));
        textShadows.push(`0 0 ${gs}px ${glowColor}`);
        textShadows.push(`0 0 ${gs * 2}px ${glowColor}`);
        textShadows.push(`0 0 ${gs * 3}px ${glowColor}`);
      }

      const containsImage = htmlEl.querySelector("img") !== null;
      if (cover.banner.enabled && !containsImage) {
        const bannerColor = cover.banner.color;
        const skew = cover.banner.skew;
        const horizontalPadding = Math.round(fs * (cover.banner.paddingPercent / 100));
        css += ` background: ${bannerColor}; display: inline-block;`;
        bannerPadding = `8px ${horizontalPadding}px`;
        bannerClipPath = `polygon(${skew}% 0%, 100% 0%, ${100-skew}% 100%, 0% 100%)`;
      }

      if (hasShadow) {
        textShadows.unshift(`${shadowOffX}px ${shadowOffY}px ${shadowBlur}px ${shadowColor}`);
      }

      if (textShadows.length > 0) {
        css += ` text-shadow: ${textShadows.join(", ")};`;
      }
      css += ` opacity: ${textOpacity};`;

      htmlEl.style.cssText += css;
      if (bannerPadding) {
        htmlEl.style.padding = bannerPadding;
        htmlEl.style.clipPath = bannerClipPath ?? "";
      }
      applyUnderlineScale(htmlEl, fs, {
        overrideColor: strokeStyle === "none" ? undefined : strokeColor,
        suppress: strokeStyle === "double",
      });
    }
  }

  // If cover image exists, add it as background
  if (coverImageSrc) {
    coverPage.classList.add("nr-cover-has-image");

    const imgEl = document.createElement("img");
    imgEl.src = coverImageSrc;
    imgEl.classList.add("nr-cover-bg-image");
    // Insert image before cover content
    const content = coverPage.querySelector(".nr-cover-content") as HTMLElement;
    coverPage.appendChild(imgEl);
    if (content) {
      coverPage.appendChild(content); // re-append on top
      // Adjust overlay opacity
      const overlayEffect = options.coverEffects?.overlay;
      if (overlayEffect && !overlayEffect.enabled) {
        content.setCssStyles({ background: "none" });
      } else if (overlayEffect && overlayEffect.opacity !== 55) {
        const op = overlayEffect.opacity / 100;
        content.setCssStyles({ background: `linear-gradient(to top, rgba(0,0,0,${op}) 0%, rgba(0,0,0,${op * 0.36}) 50%, transparent 100%)` });
      }
    }
  }

  // ── Decorative cover effects ──
  if (options.coverEffects) {
    applyPageEffects(coverPage, options.coverEffects, themeCss, pageMode, pageHeight);
  }

  // Apply cover text offset — shift child elements, not the container (which has the gradient overlay)
  const offsetX = cover.position.offsetX;
  const offsetY = cover.position.offsetY;
  if (offsetX !== 0 || offsetY !== 0) {
    const coverContent = coverPage.querySelector(".nr-cover-content") as HTMLElement;
    if (coverContent) {
      const pxX = Math.round(pageWidth * offsetX / 100);
      const pxY = Math.round(pageHeight * offsetY / 100);
      for (const child of Array.from(coverContent.children)) {
        const el = child as HTMLElement;
        if (el.setCssStyles) el.setCssStyles({ transform: `translate(${pxX}px, ${pxY}px)` });
      }
    }
  }

  pages.push(coverPage);

  // --- Body pages ---
  if (structure.bodyMarkdown) {
    const bodyPages = await renderBodyPages(
      structure.bodyMarkdown,
      fullCss,
      resolveImage,
      sourcePath,
      cleanups,
      pageMode,
      pageWidth,
      pageHeight,
      contentHeight,
      themeCss,
      options.bodyEffects,
    );
    pages.push(...bodyPages);
  }

  return {
    pages,
    cleanup: () => cleanups.forEach((fn) => fn()),
    hasCoverImage,
  };
}

function buildTitleCoverPage(title: string, css: string, pageWidth: number, pageHeight: number, coverTextOpts: CoverTextOptions): HTMLElement {
  const pageDiv = createPageDiv("nr-page-cover", css, pageWidth, pageHeight);

  const content = document.createElement("div");
  content.classList.add("nr-cover-content");

  const h1 = document.createElement("h1");
  h1.textContent = title;
  content.appendChild(h1);

  autosizeCoverText(content, coverTextOpts);
  pageDiv.appendChild(content);
  return pageDiv;
}

function buildRichCoverPage(
  coverMarkdown: string,
  css: string,
  resolveImage: (name: string, sourcePath?: string) => string,
  sourcePath: string,
  pageWidth: number,
  pageHeight: number,
  coverTextOpts: CoverTextOptions
): HTMLElement {
  const pageDiv = createPageDiv("nr-page-cover", css, pageWidth, pageHeight);

  const content = document.createElement("div");
  content.classList.add("nr-cover-content");
  content.append(sanitizeHTMLToDom(renderMarkdownToHtml(coverMarkdown, (name) => resolveImage(name, sourcePath))));

  autosizeCoverText(content, coverTextOpts);
  pageDiv.appendChild(content);
  return pageDiv;
}

/**
 * Auto-size text elements on the cover page.
 *
 * Strategies:
 * - "auto": each line sized independently by character count (original behavior)
 * - "fill": all lines use the same large font size, targeting ~5-6 chars per line width
 * - "hero": first text element is extra large, subsequent elements are smaller
 */
interface CoverTextOptions {
  strokePercent: number;
  fontScale: number;       // 100 = 1x
  letterSpacing: number;   // in 0.01em (5 = 0.05em)
  lineHeight: number;      // in 0.1 (13 = 1.3)
  availableWidth: number;
  fontFamily: string;
  fontWeight: number;
}

const DEFAULT_COVER_TEXT_BASE_SIZE = 72;

function autosizeCoverText(container: HTMLElement, opts: CoverTextOptions): void {
  const { strokePercent, fontScale, letterSpacing, lineHeight, availableWidth, fontFamily, fontWeight } = opts;
  const elements = Array.from(container.querySelectorAll("p, h1, h2, h3, li, div"));
  const measurer = createCoverTextMeasurer(fontFamily, fontWeight, letterSpacing, availableWidth);
  let widestText = "";
  let widestWidth = 0;

  for (let i = 0; i < elements.length; i++) {
    const htmlEl = elements[i] as HTMLElement;
    const embeddedImages = Array.from(htmlEl.querySelectorAll("img")) as HTMLElement[];

    if (embeddedImages.length > 0) {
      htmlEl.setCssStyles({
        display: "block",
        width: "100%",
        margin: "0 auto",
        fontSize: "0",
        lineHeight: "0",
      });
      for (const image of embeddedImages) {
        image.setCssStyles({
          display: "block",
          maxWidth: "100%",
          width: "auto",
          height: "auto",
          margin: "0 auto",
          objectFit: "contain",
        });
      }
      continue;
    }

    // User-controlled inline styles: apply fontScale to existing fontSize, skip auto-sizing
    if (htmlEl.querySelector("[style]") || htmlEl.getAttribute("style")) {
      if (!htmlEl.style.fontWeight) htmlEl.setCssStyles({ fontWeight: "800" });
      if (!htmlEl.style.lineHeight) htmlEl.setCssStyles({ lineHeight: "1.3" });
      // Apply fontScale to element and its styled children
      if (fontScale !== 100) {
        const applyScale = (el: HTMLElement) => {
          if (el.style.fontSize) {
            const origSize = parseInt(el.style.fontSize);
            if (origSize > 0) el.setCssStyles({ fontSize: `${Math.round(origSize * fontScale / 100)}px` });
          }
          for (const child of Array.from(el.children)) {
            if ((child as HTMLElement).style) applyScale(child as HTMLElement);
          }
        };
        applyScale(htmlEl);
      }
      continue;
    }

    const text = htmlEl.textContent?.trim() ?? "";
    if (!text) continue;
    const measuredWidth = measurer.measure(text, 100);
    if (measuredWidth > widestWidth) {
      widestWidth = measuredWidth;
      widestText = text;
    }
  }

  const exactBaseSize = widestText ? fitCoverTextBaseSize(widestText, measurer) : DEFAULT_COVER_TEXT_BASE_SIZE;
  const scaledSize = Math.round(exactBaseSize * (fontScale / 100));

  for (let i = 0; i < elements.length; i++) {
    const htmlEl = elements[i] as HTMLElement;
    const embeddedImages = Array.from(htmlEl.querySelectorAll("img")) as HTMLElement[];
    if (embeddedImages.length > 0) continue;
    if (htmlEl.querySelector("[style]") || htmlEl.getAttribute("style")) continue;
    const text = htmlEl.textContent?.trim() ?? "";
    if (!text) continue;

    htmlEl.setCssStyles({
      fontSize: `${scaledSize}px`,
      fontWeight: String(fontWeight),
      lineHeight: String(lineHeight),
      letterSpacing: `${letterSpacing / 100}em`,
    });

    if (strokePercent > 0) {
      const sw = Math.max(1, Math.round(scaledSize * strokePercent));
      htmlEl.dataset.coverStrokeWidth = String(sw);
    }
  }

  measurer.cleanup();
}

interface CoverTextWidthMeasurer {
  fit: (text: string) => number;
  measure: (text: string, fontSize: number) => number;
  cleanup: () => void;
  usedDomProbe: boolean;
}

function createCoverTextMeasurer(
  fontFamily: string,
  fontWeight: number,
  letterSpacing: number,
  availableWidth: number,
): CoverTextWidthMeasurer {
  const probe = document.createElement("span");
  probe.setCssStyles({
    position: "absolute",
    left: "-100000px",
    top: "0",
    visibility: "hidden",
    whiteSpace: "pre",
    pointerEvents: "none",
    fontFamily,
    fontWeight: String(fontWeight),
    letterSpacing: `${letterSpacing / 100}em`,
  });
  document.body.appendChild(probe);

  return {
    usedDomProbe: false,
    fit(text: string): number {
      return fitCoverTextBaseSizeFromWidth(text, availableWidth, this);
    },
    measure(text: string, fontSize: number): number {
      probe.style.fontSize = `${fontSize}px`;
      probe.textContent = text;
      const rect = probe.getBoundingClientRect();
      if (rect.width > 0) {
        this.usedDomProbe = true;
        return rect.width;
      }
      this.usedDomProbe = false;
      return approximateCoverTextWidth(text, fontSize);
    },
    cleanup(): void {
      probe.remove();
    },
  };
}

function fitCoverTextBaseSize(
  text: string,
  measurer: CoverTextWidthMeasurer,
): number {
  return measurer.fit(text);
}

function fitCoverTextBaseSizeFromWidth(
  text: string,
  availableWidth: number,
  measurer: CoverTextWidthMeasurer,
): number {
  const referenceFontSize = 100;
  const measuredWidth = measurer.measure(text, referenceFontSize);
  if (measuredWidth <= 0) {
    return DEFAULT_COVER_TEXT_BASE_SIZE;
  }
  const fitted = Math.floor((availableWidth / measuredWidth) * referenceFontSize);
  return Math.min(160, Math.max(DEFAULT_COVER_TEXT_BASE_SIZE, fitted));
}

function approximateCoverTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    if (/\s/.test(char)) {
      width += fontSize * 0.33;
    } else if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(char)) {
      width += fontSize;
    } else if (/[\u{1F300}-\u{1FAFF}]/u.test(char)) {
      width += fontSize * 1.1;
    } else if (/[A-Z0-9]/.test(char)) {
      width += fontSize * 0.72;
    } else if (/[a-z]/.test(char)) {
      width += fontSize * 0.58;
    } else {
      width += fontSize * 0.52;
    }
  }
  return width;
}

function createPageDiv(extraClass: string, css: string, pageWidth: number, pageHeight: number): HTMLElement {
  const pageDiv = document.createElement("div");
  pageDiv.classList.add("nr-page", extraClass);
  pageDiv.setCssStyles({
    width: `${pageWidth}px`,
    height: `${pageHeight}px`,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
  });

  // eslint-disable-next-line obsidianmd/no-forbidden-elements -- Offscreen export pages must inline theme CSS; styles.css does not reach html-to-image clones.
  pageDiv.createEl("style", { text: css });

  return pageDiv;
}

async function renderBodyPages(
  bodyMarkdown: string,
  css: string,
  resolveImage: (name: string, sourcePath?: string) => string,
  sourcePath: string,
  cleanups: (() => void)[],
  pageMode: PageMode,
  pageWidth: number,
  pageHeight: number,
  contentHeight: number,
  themeCss: string,
  bodyEffects: RenderOptions["bodyEffects"],
): Promise<HTMLElement[]> {
  // Render markdown to HTML using shared engine
  const bodyHtml = renderMarkdownToHtml(bodyMarkdown, (name) => resolveImage(name, sourcePath));

  // Create hidden measurer at full resolution
  const measurer = document.createElement("div");
  measurer.classList.add("nr-measurer", "nr-offscreen");
  measurer.setCssStyles({
    width: `${pageWidth}px`,
    boxSizing: "border-box",
  });
  document.body.appendChild(measurer);

  // eslint-disable-next-line obsidianmd/no-forbidden-elements -- Measurement must use the same inline theme CSS as the exported offscreen page.
  measurer.createEl("style", { text: css });

  // Match the final body-page shell so pagination measures the same box model.
  const pageShell = document.createElement("div");
  pageShell.classList.add("nr-page", "nr-page-body");
  measurer.appendChild(pageShell);

  const contentDiv = document.createElement("div");
  contentDiv.classList.add("nr-page-content");
  contentDiv.append(sanitizeHTMLToDom(bodyHtml));
  pageShell.appendChild(contentDiv);

  // Wait for layout + images to load
  await waitForFonts();
  await waitForImages(contentDiv);
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));

  // Paginate
  const pageData = paginateBody(contentDiv, contentHeight);

  // Build page elements
  const pageElements = pageData.map((page, idx) => {
    const pageDiv = document.createElement("div");
    pageDiv.dataset.pageIndex = String(idx + 1);

    if (page.isFullPage) {
      pageDiv.classList.add("nr-page", "nr-page-full");
      pageDiv.style.width = `${pageWidth}px`;
      pageDiv.style.height = `${pageHeight}px`;

      // eslint-disable-next-line obsidianmd/no-forbidden-elements -- Full-page exports are rendered offscreen and need embedded CSS for html-to-image.
      pageDiv.createEl("style", { text: css });

      for (const el of page.elements) {
        const clone = el.cloneNode(true) as HTMLElement;
        const img = clone.querySelector("img.nr-full-page") || (clone.tagName === "IMG" ? clone : null);
        if (img) {
          const isCover = (img as HTMLElement).classList.contains("nr-full-cover");
          (img as HTMLElement).classList.add("nr-full-page-img");
          if (isCover) (img as HTMLElement).classList.add("nr-full-cover");
        }
        pageDiv.appendChild(clone);
      }
    } else {
      pageDiv.classList.add("nr-page", "nr-page-body");
      pageDiv.style.width = `${pageWidth}px`;
      pageDiv.style.height = `${pageHeight}px`;

      // eslint-disable-next-line obsidianmd/no-forbidden-elements -- Body-page exports are rendered offscreen and need embedded CSS for html-to-image.
      pageDiv.createEl("style", { text: css });

      const pageContent = document.createElement("div");
      pageContent.classList.add("nr-page-content");

      for (const el of page.elements) {
        pageContent.appendChild(el.cloneNode(true));
      }

      pageDiv.appendChild(pageContent);
      if (bodyEffects) {
        applyPageEffects(pageDiv, bodyEffects, themeCss, pageMode, pageHeight);
      }
    }
    return pageDiv;
  });

  cleanups.push(() => measurer.remove());

  return pageElements;
}

/** Wait for all images in a container to finish loading */
function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        })
    )
  ).then(() => {});
}

function waitForFonts(): Promise<void> {
  if (!("fonts" in document)) return Promise.resolve();
  return (document as Document & { fonts?: FontFaceSet }).fonts?.ready.then(() => {}) ?? Promise.resolve();
}

function buildCoverMarkCss(
  options: RenderOptions,
  accentColor: string,
  highlightColor: string | undefined,
  themeName: string,
  hasCoverImage: boolean,
): string {
  const style = options.coverMarkStyle ?? "marker";
  const baseFill = hasCoverImage
    ? "rgba(255,255,255,0.34)"
    : (highlightColor || withAlpha(accentColor, 26));
  const fill = style === "block"
    ? boostAlpha(baseFill, 1.55, 0.78)
    : style === "underline"
      ? boostAlpha(baseFill, 1.35, 0.64)
      : boostAlpha(baseFill, 1.18, 0.52);

  switch (style) {
    case "none":
      return "background: none; padding: 0; border-radius: 0; box-shadow: none; color: inherit;";
    case "underline":
      return `background: none; color: inherit; padding: 0 0.08em; border-radius: 0; box-shadow: inset 0 -0.18em 0 ${fill};`;
    case "block":
      return buildCoverMarkBlockCss(fill, themeName, hasCoverImage);
    case "marker":
    default:
      return `background: linear-gradient(to top, ${fill} 38%, transparent 38%); color: inherit; padding: 0 0.1em; border-radius: 0.12em; box-decoration-break: clone; -webkit-box-decoration-break: clone;`;
  }
}

function buildCoverMarkBlockCss(fill: string, themeName: string, hasCoverImage: boolean): string {
  if (hasCoverImage) {
    return `background: ${fill}; color: inherit; padding: 0.05em 0.18em 0.08em; border-radius: 0.16em; box-decoration-break: clone; -webkit-box-decoration-break: clone;`;
  }

  switch (themeName) {
    case "paper":
    case "graphite":
      return `background: ${fill}; color: inherit; padding: 0.03em 0.16em 0.07em; border-radius: 0.12em; box-shadow: 0 0.02em 0 rgba(0,0,0,0.10); box-decoration-break: clone; -webkit-box-decoration-break: clone;`;
    case "cream":
    case "latte":
    case "amber":
    case "rose":
      return `background: ${fill}; color: inherit; padding: 0.05em 0.2em 0.09em; border-radius: 0.2em; box-shadow: 0 0.06em 0 rgba(0,0,0,0.08); box-decoration-break: clone; -webkit-box-decoration-break: clone;`;
    case "mist":
    case "sage":
    case "ink-gold":
      return `background: ${fill}; color: inherit; padding: 0.04em 0.18em 0.08em; border-radius: 0.22em; box-shadow: 0 0.03em 0 rgba(255,255,255,0.10) inset; box-decoration-break: clone; -webkit-box-decoration-break: clone;`;
    default:
      return `background: ${fill}; color: inherit; padding: 0.04em 0.18em 0.08em; border-radius: 0.16em; box-decoration-break: clone; -webkit-box-decoration-break: clone;`;
  }
}

function boostAlpha(color: string, factor: number, maxAlpha: number): string {
  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) return color;

  const parts = rgbMatch[1].split(",").map((part) => part.trim());
  if (parts.length < 3) return color;
  const alpha = parts.length >= 4 ? parseFloat(parts[3]) : 1;
  const nextAlpha = Math.max(0, Math.min(maxAlpha, alpha * factor));
  return `rgba(${parts[0]},${parts[1]},${parts[2]},${nextAlpha})`;
}

function withAlpha(color: string, opacityPercent: number): string {
  const alpha = Math.max(0, Math.min(1, opacityPercent / 100));

  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const normalized = hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex;
    if (normalized.length === 6) {
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
    }
  }

  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

function ensureDoubleStrokeBackdrop(el: HTMLElement, radius: number, color: string, opacity = 1): HTMLElement | null {
  return ensureOutlineBackdrop(el, radius, color, opacity);
}

function ensureOutlineBackdrop(el: HTMLElement, radius: number, color: string, opacity = 1): HTMLElement | null {
  const parent = el.parentElement;
  if (!parent) return null;

  const computed = getComputedStyle(el);
  const wrapper = document.createElement("div");
  wrapper.classList.add("nr-double-stroke-wrap");
  wrapper.setCssStyles({ position: "relative" });
  wrapper.style.display = computed.display === "block" ? "block" : "inline-block";
  wrapper.style.width = computed.display === "block" ? "100%" : "fit-content";
  wrapper.style.marginTop = computed.marginTop;
  wrapper.style.marginRight = computed.marginRight;
  wrapper.style.marginBottom = computed.marginBottom;
  wrapper.style.marginLeft = computed.marginLeft;

  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.cssText = el.style.cssText;
  clone.setCssStyles({
    position: "absolute",
    inset: "0",
    zIndex: "0",
    pointerEvents: "none",
    margin: "0",
  });
  clone.style.opacity = String(opacity);
  clone.style.color = color;
  clone.dataset.doubleStrokeRadius = String(radius);
  clone.setCssStyles({ webkitTextStroke: "0 transparent" });
  clone.style.textShadow = buildOutlineRingShadows(radius, color).join(", ");

  el.setCssStyles({
    margin: "0",
    position: "relative",
    zIndex: "1",
  });

  parent.replaceChild(wrapper, el);
  wrapper.appendChild(clone);
  wrapper.appendChild(el);
  return clone;
}

interface UnderlineRenderOptions {
  overrideColor?: string;
  suppress?: boolean;
}

function applyUnderlineScale(container: HTMLElement, fallbackFontSize: number, options: UnderlineRenderOptions = {}): void {
  const underlines = Array.from(container.querySelectorAll<HTMLElement>("u"));
  if (underlines.length === 0) return;

  for (const underline of underlines) {
    const fontSize = resolveUnderlineFontSize(underline, fallbackFontSize);
    const waveHeight = Math.max(12, Math.round(10 + fontSize * 0.22));
    const paddingBottom = Math.max(8, Math.round(6 + fontSize * 0.12));
    const strokeWidth = Math.max(3, Number((2 + fontSize * 0.055).toFixed(1)));
    const color = options.overrideColor || resolveUnderlineColor(underline);
    underline.style.backgroundImage = options.suppress
      ? "none"
      : `url("${buildUnderlineSvgDataUri(color, strokeWidth, waveHeight)}")`;
    underline.style.backgroundSize = options.suppress ? "" : `200px ${waveHeight}px`;
    underline.style.paddingBottom = `${paddingBottom}px`;
  }
}

function resolveUnderlineFontSize(underline: HTMLElement, fallbackFontSize: number): number {
  let current: HTMLElement | null = underline;
  while (current) {
    const inlineSize = Number.parseFloat(current.style.fontSize);
    if (Number.isFinite(inlineSize) && inlineSize > 0) return inlineSize;
    current = current.parentElement;
  }

  const computed = window.getComputedStyle(underline);
  const parsed = Number.parseFloat(computed.fontSize);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallbackFontSize > 0 ? fallbackFontSize : 68;
}

function resolveUnderlineColor(underline: HTMLElement): string {
  const computed = window.getComputedStyle(underline);
  return computed.color || "#000000";
}

function buildUnderlineSvgDataUri(color: string, strokeWidth: number, waveHeight: number): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 ${waveHeight}">`,
    `<path d="${buildUnderlinePath(waveHeight)}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`,
    "</svg>",
  ].join("");

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function buildUnderlinePath(waveHeight: number): string {
  const midY = Math.max(8, Math.round(waveHeight * 0.67));
  const crestY = Math.max(2, Math.round(waveHeight * 0.17));
  const checkpoints = [
    `M2 ${midY}`,
    `Q30 ${crestY} 50 ${midY - 1}`,
    `T100 ${midY - 2}`,
    `T150 ${midY}`,
    `T198 ${Math.max(crestY + 1, midY - 3)}`,
  ];
  return checkpoints.join(" ");
}

function buildOutlineRingShadows(radius: number, color: string): string[] {
  const clampedRadius = Math.max(1, radius);
  const layers = Math.max(2, Math.min(6, Math.ceil(clampedRadius / 2)));
  const blur = Math.max(0.35, Number((clampedRadius * 0.12).toFixed(2)));
  const shadows = new Set<string>();

  for (let layer = 1; layer <= layers; layer++) {
    const layerRadius = Number(((clampedRadius * layer) / layers).toFixed(2));
    const steps = Math.max(24, Math.ceil(layerRadius * 18));
    for (let i = 0; i < steps; i++) {
      const angle = (Math.PI * 2 * i) / steps;
      const x = Number((Math.cos(angle) * layerRadius).toFixed(2));
      const y = Number((Math.sin(angle) * layerRadius).toFixed(2));
      shadows.add(`${x}px ${y}px ${blur}px ${color}`);
    }
  }

  return Array.from(shadows);
}
