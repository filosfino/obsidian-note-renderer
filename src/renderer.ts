import { App, Component, sanitizeHTMLToDom } from "obsidian";
import { PAGE_WIDTH, CONTENT_WIDTH, PAGE_PADDING_H, PAGE_PADDING_TOP, PAGE_PADDING_BOTTOM, PAGE_HEIGHTS, getContentHeight } from "./constants";
import { paginateBody, Page } from "./paginator";
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
  options: RenderOptions = { fontSize: 42, fontFamily: '"PingFang SC", sans-serif', coverFontFamily: '', coverStyle: "auto", pageMode: "long" }
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
  const fullCss = themeCss + fontOverrideCss;

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
      imgEl.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        object-fit: cover;
        border-radius: 16px;
        z-index: 0;
      `;
      // Insert image before cover content
      const content = coverPage.querySelector(".nr-cover-content") as HTMLElement;
      if (content) {
        content.style.position = "relative";
        content.style.zIndex = "1";
      }
      coverPage.style.padding = "0";
      coverPage.appendChild(imgEl);
      if (content) {
        coverPage.appendChild(content); // re-append on top
        content.style.padding = `${PAGE_PADDING_TOP}px ${PAGE_PADDING_H}px ${PAGE_PADDING_BOTTOM}px`;
        // Adjust overlay opacity
        if (options.coverOverlay === false) {
          content.style.background = "none";
        } else if (options.coverOverlayOpacity !== undefined && options.coverOverlayOpacity !== 55) {
          const op = options.coverOverlayOpacity / 100;
          content.style.background = `linear-gradient(to top, rgba(0,0,0,${op}) 0%, rgba(0,0,0,${op * 0.36}) 50%, transparent 100%)`;
        }
      }
    }
  }

  // ── Decorative cover effects (layered pseudo-elements via wrapper divs) ──
  coverPage.style.position = "relative";
  coverPage.style.overflow = "hidden";

  // Detect theme brightness from CSS background color
  const isDark = (() => {
    const bgMatch = themeCss.match(/\.nr-page\s*\{[^}]*background:\s*#([0-9a-fA-F]{3,6})/);
    if (!bgMatch) return true; // default assume dark
    const hex = bgMatch[1].length === 3
      ? bgMatch[1].split("").map(c => c + c).join("")
      : bgMatch[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
  })();
  // Effect colors: light particles on dark bg, dark particles on light bg
  const effectColor = isDark ? "rgba(255,255,255," : "rgba(0,0,0,";
  const effectBlend = isDark ? "screen" : "multiply";

  // Grain: SVG feTurbulence noise overlay
  if (options.coverGrain) {
    const grainOp = (options.coverGrainOpacity ?? 8) / 100;
    const grain = document.createElement("div");
    grain.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;opacity:${grainOp};mix-blend-mode:overlay;`;
    grain.innerHTML = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><filter id="nr-grain-${Date.now()}"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#nr-grain-${Date.now()})"/></svg>`;
    coverPage.appendChild(grain);
  }

  // Aurora: blurred color blobs
  if (options.coverAurora) {
    const auroraOp = (options.coverAuroraOpacity ?? 30) / 100;
    const aurora = document.createElement("div");
    aurora.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;opacity:${auroraOp};mix-blend-mode:${effectBlend};overflow:hidden;`;
    const auroraColors = isDark
      ? ["rgba(120,80,220,0.8)", "rgba(40,160,180,0.7)", "rgba(200,80,120,0.5)"]
      : ["rgba(100,60,180,0.6)", "rgba(30,130,150,0.5)", "rgba(180,60,100,0.4)"];
    aurora.innerHTML = `
      <div style="position:absolute;width:60%;height:50%;top:10%;left:-10%;background:radial-gradient(circle,${auroraColors[0]},transparent 70%);filter:blur(80px);"></div>
      <div style="position:absolute;width:50%;height:40%;top:50%;right:-5%;background:radial-gradient(circle,${auroraColors[1]},transparent 70%);filter:blur(70px);"></div>
      <div style="position:absolute;width:40%;height:35%;bottom:5%;left:20%;background:radial-gradient(circle,${auroraColors[2]},transparent 70%);filter:blur(60px);"></div>
    `;
    coverPage.appendChild(aurora);
  }

  // Bokeh: scattered soft circles
  if (options.coverBokeh) {
    const bokehOp = (options.coverBokehOpacity ?? 12) / 100;
    const bokeh = document.createElement("div");
    bokeh.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;opacity:${bokehOp};`;
    // Generate deterministic bokeh circles using box-shadow on a single element
    const circles: string[] = [];
    const seed = [0.15,0.73,0.42,0.88,0.31,0.67,0.09,0.56,0.81,0.24,0.95,0.38,0.61,0.77,0.03,0.49];
    for (let i = 0; i < 16; i++) {
      const x = Math.round(seed[i] * PAGE_WIDTH);
      const y = Math.round(seed[(i + 5) % 16] * pageHeight);
      const size = 20 + Math.round(seed[(i + 3) % 16] * 60);
      const alpha = 0.3 + seed[(i + 7) % 16] * 0.5;
      circles.push(`${x}px ${y}px 0 ${size}px ${effectColor}${alpha.toFixed(2)})`);
    }
    bokeh.innerHTML = `<div style="position:absolute;width:1px;height:1px;top:0;left:0;border-radius:50%;box-shadow:${circles.join(",")};"></div>`;
    coverPage.appendChild(bokeh);
  }

  // Grid: subtle geometric line pattern
  if (options.coverGrid) {
    const gridOp = (options.coverGridOpacity ?? 6) / 100;
    const grid = document.createElement("div");
    const lineColor = effectColor + "0.3)";
    grid.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;opacity:${gridOp};background-image:repeating-linear-gradient(0deg,${lineColor} 0px,${lineColor} 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,${lineColor} 0px,${lineColor} 1px,transparent 1px,transparent 60px);`;
    coverPage.appendChild(grid);
  }

  // Vignette: radial darkening from edges
  if (options.coverVignette) {
    const vigOp = (options.coverVignetteOpacity ?? 50) / 100;
    const vignette = document.createElement("div");
    vignette.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,${vigOp}) 100%);`;
    coverPage.appendChild(vignette);
  }

  // Light leak: warm color bleed from corners
  if (options.coverLightLeak) {
    const leakOp = (options.coverLightLeakOpacity ?? 25) / 100;
    const leak = document.createElement("div");
    leak.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;opacity:${leakOp};mix-blend-mode:${effectBlend};overflow:hidden;`;
    const leakColors = isDark
      ? ["rgba(255,180,80,0.9)", "rgba(255,120,100,0.7)"]
      : ["rgba(200,140,50,0.7)", "rgba(200,80,60,0.5)"];
    leak.innerHTML = `
      <div style="position:absolute;width:50%;height:50%;top:-10%;right:-10%;background:radial-gradient(circle,${leakColors[0]},transparent 70%);filter:blur(60px);"></div>
      <div style="position:absolute;width:40%;height:40%;bottom:-5%;left:-5%;background:radial-gradient(circle,${leakColors[1]},transparent 70%);filter:blur(50px);"></div>
    `;
    coverPage.appendChild(leak);
  }

  // Scanlines: horizontal thin lines
  if (options.coverScanlines) {
    const scanOp = (options.coverScanlinesOpacity ?? 8) / 100;
    const scan = document.createElement("div");
    const scanColor = effectColor + "0.5)";
    scan.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;opacity:${scanOp};background:repeating-linear-gradient(to bottom,transparent 0px,transparent 2px,${scanColor} 2px,${scanColor} 4px);`;
    coverPage.appendChild(scan);
  }

  // Particle network: nodes + connecting lines (constellation / molecular structure)
  if (options.coverNetwork) {
    const netOp = (options.coverNetworkOpacity ?? 15) / 100;
    const cols = 10;
    const rows = Math.round(cols * pageHeight / PAGE_WIDTH);
    const cellW = PAGE_WIDTH / cols;
    const cellH = pageHeight / rows;
    const threshold = Math.max(cellW, cellH) * 1.6;

    // Deterministic pseudo-random using simple seed
    let seed = 42;
    const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };

    // Generate jittered grid nodes
    const nodes: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cellW + (rand() - 0.5) * cellW * 0.8;
        const y = (r + 0.5) * cellH + (rand() - 0.5) * cellH * 0.8;
        nodes.push({ x, y });
      }
    }

    // Build SVG with lines then circles
    let svgContent = "";
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < threshold) {
          const lineOp = Math.pow(1 - d / threshold, 1.5).toFixed(2);
          svgContent += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="currentColor" stroke-width="1" opacity="${lineOp}"/>`;
        }
      }
    }
    for (const n of nodes) {
      svgContent += `<circle cx="${n.x}" cy="${n.y}" r="${2 + rand() * 2}" fill="currentColor" opacity="${(0.4 + rand() * 0.3).toFixed(2)}"/>`;
    }

    const network = document.createElement("div");
    const netColor = isDark ? "rgba(200,200,200,1)" : "rgba(80,80,80,1)";
    network.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;opacity:${netOp};color:${netColor};`;
    network.innerHTML = `<svg width="${PAGE_WIDTH}" height="${pageHeight}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
    coverPage.appendChild(network);
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
        if (el.style) el.style.transform = `translate(${pxX}px, ${pxY}px)`;
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
      if (!htmlEl.style.fontWeight) htmlEl.style.fontWeight = "800";
      if (!htmlEl.style.lineHeight) htmlEl.style.lineHeight = "1.3";
      // Apply fontScale to element and its styled children
      if (fontScale !== 100) {
        const applyScale = (el: HTMLElement) => {
          if (el.style.fontSize) {
            const origSize = parseInt(el.style.fontSize);
            if (origSize > 0) el.style.fontSize = `${Math.round(origSize * fontScale / 100)}px`;
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
    const len = text.length;
    const fontSize = fillSize;

    const scaledSize = Math.round(fontSize * (fontScale / 100));
    htmlEl.style.fontSize = `${scaledSize}px`;
    htmlEl.style.fontWeight = "800";
    htmlEl.style.lineHeight = String(lineHeight / 10);
    htmlEl.style.letterSpacing = `${letterSpacing / 100}em`;

    // Pre-compute stroke width for cover-on-image
    if (strokePercent > 0) {
      const sw = Math.max(1, Math.round(scaledSize * strokePercent));
      htmlEl.dataset.coverStrokeWidth = String(sw);
    }
  }
}

function createPageDiv(extraClass: string, css: string, pageHeight: number): HTMLElement {
  const pageDiv = document.createElement("div");
  pageDiv.classList.add("nr-page", extraClass);
  pageDiv.style.cssText = `
    width: ${PAGE_WIDTH}px;
    height: ${pageHeight}px;
    padding: ${PAGE_PADDING_TOP}px ${PAGE_PADDING_H}px ${PAGE_PADDING_BOTTOM}px;
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  pageDiv.appendChild(styleEl);

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
  measurer.classList.add("nr-measurer");
  measurer.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: ${PAGE_WIDTH}px;
    padding: ${PAGE_PADDING_TOP}px ${PAGE_PADDING_H}px ${PAGE_PADDING_BOTTOM}px;
    box-sizing: border-box;
  `;
  document.body.appendChild(measurer);

  const measureStyle = document.createElement("style");
  measureStyle.textContent = css;
  measurer.appendChild(measureStyle);

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
      pageDiv.style.cssText = `
        width: ${PAGE_WIDTH}px;
        height: ${pageHeight}px;
        padding: 0;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
      `;

      const pageStyle = document.createElement("style");
      pageStyle.textContent = css;
      pageDiv.appendChild(pageStyle);

      for (const el of page.elements) {
        const clone = el.cloneNode(true) as HTMLElement;
        const img = clone.querySelector("img.nr-full-page") || (clone.tagName === "IMG" ? clone : null);
        if (img) {
          const isCover = (img as HTMLElement).classList.contains("nr-full-cover");
          (img as HTMLElement).style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: ${isCover ? "cover" : "contain"};
            display: block;
          `;
        }
        pageDiv.appendChild(clone);
      }
    } else {
      pageDiv.classList.add("nr-page", "nr-page-body");
      pageDiv.style.cssText = `
        width: ${PAGE_WIDTH}px;
        height: ${pageHeight}px;
        padding: ${PAGE_PADDING_TOP}px ${PAGE_PADDING_H}px ${PAGE_PADDING_BOTTOM}px;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
      `;

      const pageStyle = document.createElement("style");
      pageStyle.textContent = css;
      pageDiv.appendChild(pageStyle);

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
