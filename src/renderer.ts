import { App, Component } from "obsidian";
import { PAGE_WIDTH, PAGE_HEIGHT, PAGE_PADDING } from "./constants";
import { paginateBody, Page } from "./paginator";
import { parseNoteStructure } from "./parser";
import { renderMarkdownToHtml, createVaultImageResolver } from "./md-to-html";

export interface RenderedPages {
  pages: HTMLElement[];
  cleanup: () => void;
}

export interface RenderOptions {
  fontSize: number;
  fontFamily: string;
}

export async function renderNote(
  app: App,
  markdown: string,
  sourcePath: string,
  templateCss: string,
  parentComponent: Component,
  options: RenderOptions = { fontSize: 42, fontFamily: '"PingFang SC", sans-serif' }
): Promise<RenderedPages> {
  const structure = parseNoteStructure(markdown);
  const cleanups: (() => void)[] = [];
  const resolveImage = createVaultImageResolver(app);

  // Build full CSS: template + font overrides
  const fontOverrideCss = `
.nr-page {
  font-size: ${options.fontSize}px;
  font-family: ${options.fontFamily};
  line-height: 1.75;
  letter-spacing: 0.05em;
}
`;
  const fullCss = templateCss + fontOverrideCss;

  const pages: HTMLElement[] = [];

  // --- Cover page ---
  let coverPage: HTMLElement;
  if (structure.coverMarkdown) {
    coverPage = buildRichCoverPage(structure.coverMarkdown, fullCss, resolveImage);
  } else {
    coverPage = buildTitleCoverPage(structure.title, fullCss);
  }
  pages.push(coverPage);

  // --- Body pages ---
  if (structure.bodyMarkdown) {
    const bodyPages = await renderBodyPages(
      structure.bodyMarkdown,
      fullCss,
      resolveImage,
      cleanups
    );
    pages.push(...bodyPages);
  }

  return {
    pages,
    cleanup: () => cleanups.forEach((fn) => fn()),
  };
}

function buildTitleCoverPage(title: string, css: string): HTMLElement {
  const pageDiv = createPageDiv("nr-page-cover", css);

  const content = document.createElement("div");
  content.classList.add("nr-cover-content");

  const h1 = document.createElement("h1");
  h1.textContent = title;
  content.appendChild(h1);

  autosizeCoverText(content);
  pageDiv.appendChild(content);
  return pageDiv;
}

function buildRichCoverPage(
  coverMarkdown: string,
  css: string,
  resolveImage: (name: string) => string
): HTMLElement {
  const pageDiv = createPageDiv("nr-page-cover", css);

  const content = document.createElement("div");
  content.classList.add("nr-cover-content");
  content.innerHTML = renderMarkdownToHtml(coverMarkdown, resolveImage);

  autosizeCoverText(content);
  pageDiv.appendChild(content);
  return pageDiv;
}

/**
 * Auto-size text elements on the cover page.
 */
function autosizeCoverText(container: HTMLElement): void {
  const elements = container.querySelectorAll("p, h1, h2, h3, li");
  for (const el of elements) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    const len = text.length;

    let fontSize: number;
    if (len <= 4) {
      fontSize = 128;
    } else if (len <= 8) {
      fontSize = 108;
    } else if (len <= 12) {
      fontSize = 88;
    } else if (len <= 16) {
      fontSize = 72;
    } else if (len <= 24) {
      fontSize = 60;
    } else {
      fontSize = 48;
    }

    (el as HTMLElement).style.fontSize = `${fontSize}px`;
    (el as HTMLElement).style.fontWeight = "800";
    (el as HTMLElement).style.lineHeight = "1.3";
  }
}

function createPageDiv(extraClass: string, css: string): HTMLElement {
  const pageDiv = document.createElement("div");
  pageDiv.classList.add("nr-page", extraClass);
  pageDiv.style.cssText = `
    width: ${PAGE_WIDTH}px;
    height: ${PAGE_HEIGHT}px;
    padding: ${PAGE_PADDING}px;
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
  cleanups: (() => void)[]
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
    padding: ${PAGE_PADDING}px;
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
  contentDiv.innerHTML = bodyHtml;
  pageShell.appendChild(contentDiv);

  // Wait for layout + images to load
  await waitForImages(contentDiv);
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));

  // Paginate
  const pageData = paginateBody(contentDiv);

  // Build page elements
  const pageElements = pageData.map((page, idx) => {
    const pageDiv = document.createElement("div");
    pageDiv.classList.add("nr-page", "nr-page-body");
    pageDiv.dataset.pageIndex = String(idx + 1);

    pageDiv.style.cssText = `
      width: ${PAGE_WIDTH}px;
      height: ${PAGE_HEIGHT}px;
      padding: ${PAGE_PADDING}px;
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
