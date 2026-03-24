import { App, Component, sanitizeHTMLToDom } from "obsidian";
import { PAGE_WIDTH, CONTENT_WIDTH, PAGE_PADDING_H, PAGE_PADDING_TOP, PAGE_PADDING_BOTTOM, PAGE_HEIGHTS, getContentHeight } from "./constants";
import { applyCoverEffects } from "./effects";
import { paginateBody } from "./paginator";
import { parseNoteStructure } from "./parser";
import { renderMarkdownToHtml, createVaultImageResolver } from "./md-to-html";
import type { RenderOptions } from "./schema";

export type { RenderOptions };

export interface RenderedPages {
  pages: HTMLElement[];
  cleanup: () => void;
  hasCoverImage: boolean;
}

export async function renderNote(
  app: App,
  markdown: string,
  sourcePath: string,
  themeCss: string,
  parentComponent: Component,
  options: RenderOptions
): Promise<RenderedPages> {
  const structure = parseNoteStructure(markdown);
  const cleanups: (() => void)[] = [];
  const resolveImage = createVaultImageResolver(app);
  const pageHeight = PAGE_HEIGHTS[options.pageMode];
  const contentHeight = getContentHeight(options.pageMode);

  const coverFont = options.coverFontFamily || options.fontFamily;
  const coverColor = options.coverFontColor || "";

  // Build full CSS: theme + font overrides
  const coverColorCss = coverColor ? `
.nr-page-cover .nr-cover-content h1,
.nr-page-cover .nr-cover-content p { color: ${coverColor}; }
.nr-page-cover .nr-cover-content::before { background: ${coverColor}; }
` : "";
  const textAlign = options.coverTextAlign ?? "left";
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
  font-weight: ${options.coverFontWeight ?? 800};
  align-items: ${alignItems};
  text-align: ${textAlign};
}
.nr-page-cover .nr-cover-content h1,
.nr-page-cover .nr-cover-content h2,
.nr-page-cover .nr-cover-content h3,
.nr-page-cover .nr-cover-content p {
  font-weight: ${options.coverFontWeight ?? 800};
}
${coverColorCss}
`;
  const pageCss = `
.nr-page {
  width: ${PAGE_WIDTH}px;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}
.nr-page-cover, .nr-page-body {
  height: ${pageHeight}px;
  padding: ${PAGE_PADDING_TOP}px ${PAGE_PADDING_H}px ${PAGE_PADDING_BOTTOM}px;
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
  border-radius: 16px;
  z-index: 0;
}
.nr-cover-has-image .nr-cover-content {
  position: relative;
  z-index: 1;
  padding: ${PAGE_PADDING_TOP}px ${PAGE_PADDING_H}px ${PAGE_PADDING_BOTTOM}px;
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
  z-index: 2;
}
`;
  const fullCss = themeCss + fontOverrideCss + pageCss;

  const pages: HTMLElement[] = [];

  // --- Cover page ---
  const strokePercent = (options.coverStrokePercent ?? 8) / 100;
  const hasCoverImage = !!structure.coverImageMarkdown;
  const coverTextOpts: CoverTextOptions = {
    strokePercent,
    fontScale: options.coverFontScale ?? 100,
    letterSpacing: options.coverLetterSpacing ?? 5,
    lineHeight: options.coverLineHeight ?? 13,
  };
  let coverPage: HTMLElement;
  if (structure.coverMarkdown) {
    coverPage = buildRichCoverPage(structure.coverMarkdown, fullCss, resolveImage, pageHeight, coverTextOpts);
  } else {
    coverPage = buildTitleCoverPage(structure.title, fullCss, pageHeight, coverTextOpts);
  }

  // Apply effects to cover text (works with or without cover image)
  {
    const strokeStyle = options.coverStrokeStyle || "stroke";
    const hasShadow = options.coverShadow !== false;
    const shadowBlur = options.coverShadowBlur ?? 16;
    const shadowOffX = options.coverShadowOffsetX ?? 0;
    const shadowOffY = options.coverShadowOffsetY ?? 4;
    const allCoverText = coverPage.querySelectorAll(".nr-cover-content p, .nr-cover-content h1, .nr-cover-content h2, .nr-cover-content h3, .nr-cover-content div");
    for (const el of allCoverText) {
      const htmlEl = el as HTMLElement;
      const fs = parseInt(htmlEl.style.fontSize) || 120;
      const sw = Math.max(1, Math.round(fs * strokePercent));
      const accentColor = htmlEl.style.color || "#e8c36a";

      const hasInlineColor = htmlEl.style.color && htmlEl.style.color !== "";
      const textColor = coverColor || "#fff";
      let css = hasInlineColor ? ";" : `; color: ${textColor} !important;`;
      const strokeAlpha = (options.coverStrokeOpacity ?? 90) / 100;
      const glowMul = (options.coverGlowSize ?? 60) / 100;
      switch (strokeStyle) {
        case "none":
          break;
        case "stroke":
          css += ` -webkit-text-stroke: ${sw}px rgba(0,0,0,${strokeAlpha}); paint-order: stroke fill;`;
          break;
        case "double": {
          const glowSize = Math.max(2, Math.round(sw * glowMul));
          css += ` -webkit-text-stroke: ${sw}px rgba(0,0,0,${strokeAlpha}); paint-order: stroke fill;`;
          css += ` filter: drop-shadow(0 0 ${glowSize}px ${accentColor}) drop-shadow(0 0 ${glowSize}px ${accentColor}) drop-shadow(0 0 ${Math.round(glowSize * 0.5)}px ${accentColor});`;
          break;
        }
        case "glow": {
          const gs = Math.max(1, Math.round(sw * glowMul));
          css += ` -webkit-text-stroke: ${sw}px rgba(0,0,0,${strokeAlpha}); paint-order: stroke fill;`;
          css += ` text-shadow: 0 0 ${gs}px ${accentColor}, 0 0 ${gs*2}px ${accentColor}, 0 0 ${gs*3}px rgba(0,0,0,0.3);`;
          break;
        }
      }

      if (options.coverBanner) {
        const bannerColor = options.coverBannerColor || "rgba(0,0,0,0.5)";
        const skew = options.coverBannerSkew ?? 6;
        css += ` background: ${bannerColor}; display: inline-block; padding: 8px 32px; clip-path: polygon(${skew}% 0%, 100% 0%, ${100-skew}% 100%, 0% 100%);`;
      }

      if (hasShadow) {
        const shadowCss = `${shadowOffX}px ${shadowOffY}px ${shadowBlur}px rgba(0,0,0,0.6)`;
        if (css.includes("text-shadow:")) {
          css = css.replace("text-shadow:", `text-shadow: ${shadowCss},`);
        } else {
          css += ` text-shadow: ${shadowCss};`;
        }
      }

      htmlEl.style.cssText += css;
    }
  }

  // If cover image exists, add it as background
  if (structure.coverImageMarkdown) {
    const imgHtml = renderMarkdownToHtml(structure.coverImageMarkdown, resolveImage);
    const imgMatch = imgHtml.match(/src="([^"]+)"/);
    if (imgMatch) {
      coverPage.classList.add("nr-cover-has-image");

      const imgEl = document.createElement("img");
      imgEl.src = imgMatch[1];
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
  }

  // ── Decorative cover effects ──
  if (options.coverEffects) {
    applyCoverEffects(coverPage, options.coverEffects, themeCss, pageHeight);
  }

  // Apply cover text offset — shift child elements, not the container (which has the gradient overlay)
  const offsetX = options.coverOffsetX ?? 0;
  const offsetY = options.coverOffsetY ?? 0;
  if (offsetX !== 0 || offsetY !== 0) {
    const coverContent = coverPage.querySelector(".nr-cover-content") as HTMLElement;
    if (coverContent) {
      const pxX = Math.round(PAGE_WIDTH * offsetX / 100);
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
      cleanups,
      pageHeight,
      contentHeight
    );
    pages.push(...bodyPages);
  }

  return {
    pages,
    cleanup: () => cleanups.forEach((fn) => fn()),
    hasCoverImage,
  };
}

function buildTitleCoverPage(title: string, css: string, pageHeight: number, coverTextOpts: CoverTextOptions): HTMLElement {
  const pageDiv = createPageDiv("nr-page-cover", css, pageHeight);

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
  resolveImage: (name: string) => string,
  pageHeight: number,
  coverTextOpts: CoverTextOptions
): HTMLElement {
  const pageDiv = createPageDiv("nr-page-cover", css, pageHeight);

  const content = document.createElement("div");
  content.classList.add("nr-cover-content");
  content.append(sanitizeHTMLToDom(renderMarkdownToHtml(coverMarkdown, resolveImage)));

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
}

function autosizeCoverText(container: HTMLElement, opts: CoverTextOptions): void {
  const { strokePercent, fontScale, letterSpacing, lineHeight } = opts;
  const elements = Array.from(container.querySelectorAll("p, h1, h2, h3, li, div"));

  // Find the longest text to calculate fill size
  let maxLen = 0;
  for (const el of elements) {
    if ((el as HTMLElement).querySelector("[style]") || (el as HTMLElement).getAttribute("style")) continue;
    const len = (el.textContent?.trim() ?? "").length;
    if (len > maxLen) maxLen = len;
  }

  // Fill mode: calculate a uniform size so the longest line nearly fills CONTENT_WIDTH
  // Approximate: Chinese chars at font-size Npx are roughly 1.05*N px wide each
  const fillSize = Math.min(160, Math.max(72, Math.floor(CONTENT_WIDTH / (maxLen * 1.05))));

  for (let i = 0; i < elements.length; i++) {
    const htmlEl = elements[i] as HTMLElement;

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

    const fontSize = fillSize;

    const scaledSize = Math.round(fontSize * (fontScale / 100));
    htmlEl.setCssStyles({
      fontSize: `${scaledSize}px`,
      fontWeight: "800",
      lineHeight: String(lineHeight / 10),
      letterSpacing: `${letterSpacing / 100}em`,
    });

    // Pre-compute stroke width for cover-on-image
    if (strokePercent > 0) {
      const sw = Math.max(1, Math.round(scaledSize * strokePercent));
      htmlEl.dataset.coverStrokeWidth = String(sw);
    }
  }
}

function createPageDiv(extraClass: string, css: string, _pageHeight: number): HTMLElement {
  const pageDiv = document.createElement("div");
  pageDiv.classList.add("nr-page", extraClass);

  pageDiv.createEl("style", { text: css });

  return pageDiv;
}

async function renderBodyPages(
  bodyMarkdown: string,
  css: string,
  resolveImage: (name: string) => string,
  cleanups: (() => void)[],
  pageHeight: number,
  contentHeight: number
): Promise<HTMLElement[]> {
  // Render markdown to HTML using shared engine
  const bodyHtml = renderMarkdownToHtml(bodyMarkdown, resolveImage);

  // Create hidden measurer at full resolution
  const measurer = document.createElement("div");
  measurer.classList.add("nr-measurer", "nr-offscreen");
  measurer.setCssStyles({
    width: `${PAGE_WIDTH}px`,
    padding: `${PAGE_PADDING_TOP}px ${PAGE_PADDING_H}px ${PAGE_PADDING_BOTTOM}px`,
    boxSizing: "border-box",
  });
  document.body.appendChild(measurer);

  measurer.createEl("style", { text: css });

  // Wrap in .nr-page .nr-page-content for CSS selectors to match
  const pageShell = document.createElement("div");
  pageShell.classList.add("nr-page");
  measurer.appendChild(pageShell);

  const contentDiv = document.createElement("div");
  contentDiv.classList.add("nr-page-content");
  contentDiv.append(sanitizeHTMLToDom(bodyHtml));
  pageShell.appendChild(contentDiv);

  // Wait for layout + images to load
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

      pageDiv.createEl("style", { text: css });

      const pageContent = document.createElement("div");
      pageContent.classList.add("nr-page-content");

      for (const el of page.elements) {
        pageContent.appendChild(el.cloneNode(true));
      }

      pageDiv.appendChild(pageContent);
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
