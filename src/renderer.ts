import { App, MarkdownRenderer, Component } from "obsidian";
import { PAGE_WIDTH, PAGE_HEIGHT, PAGE_PADDING } from "./constants";
import { paginateBody, Page } from "./paginator";
import { parseNoteStructure } from "./parser";

export interface RenderedPages {
  pages: HTMLElement[];
  cleanup: () => void;
}

/**
 * Render a markdown note into paginated page elements.
 *
 * Flow:
 * 1. Parse markdown → title + body sections
 * 2. Build cover page from title text
 * 3. Render body markdown via Obsidian → measure → paginate
 * 4. Return all page elements
 */
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
    coverPage = await buildRichCoverPage(
      app, structure.coverMarkdown, sourcePath, fullCss, parentComponent, cleanups
    );
  } else {
    coverPage = buildTitleCoverPage(structure.title, fullCss);
  }
  pages.push(coverPage);

  // --- Body pages ---
  if (structure.bodyMarkdown) {
    const bodyPages = await renderBodyPages(
      app,
      structure.bodyMarkdown,
      sourcePath,
      fullCss,
      parentComponent,
      cleanups
    );
    pages.push(...bodyPages);
  }

  return {
    pages,
    cleanup: () => cleanups.forEach((fn) => fn()),
  };
}

function buildTitleCoverPage(title: string, templateCss: string): HTMLElement {
  const pageDiv = createPageDiv("nr-page-cover", templateCss);

  const content = document.createElement("div");
  content.classList.add("nr-cover-content");

  const h1 = document.createElement("h1");
  h1.textContent = title;
  content.appendChild(h1);

  pageDiv.appendChild(content);
  return pageDiv;
}

async function buildRichCoverPage(
  app: App,
  coverMarkdown: string,
  sourcePath: string,
  templateCss: string,
  parentComponent: Component,
  cleanups: (() => void)[]
): Promise<HTMLElement> {
  const pageDiv = createPageDiv("nr-page-cover", templateCss);

  const content = document.createElement("div");
  content.classList.add("nr-cover-content");

  await MarkdownRenderer.render(app, coverMarkdown, content, sourcePath, parentComponent);

  // Auto-size cover text: shorter lines get bigger font
  autosizeCoverText(content);

  pageDiv.appendChild(content);
  return pageDiv;
}

/**
 * Auto-size text elements on the cover page.
 * Shorter text → larger font, longer text → smaller font.
 * Targets ~960px content width: at 120px a Chinese char is ~120px,
 * so 8 chars fills one line. Scale down for longer text.
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

function createPageDiv(extraClass: string, templateCss: string): HTMLElement {
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
  styleEl.textContent = templateCss;
  pageDiv.appendChild(styleEl);

  return pageDiv;
}

async function renderBodyPages(
  app: App,
  bodyMarkdown: string,
  sourcePath: string,
  templateCss: string,
  parentComponent: Component,
  cleanups: (() => void)[]
): Promise<HTMLElement[]> {
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

  // Apply template CSS for accurate measurement
  const measureStyle = document.createElement("style");
  measureStyle.textContent = templateCss;
  measurer.appendChild(measureStyle);

  // Wrap in .nr-page .nr-page-content for CSS to match
  const pageShell = document.createElement("div");
  pageShell.classList.add("nr-page");
  measurer.appendChild(pageShell);

  const contentDiv = document.createElement("div");
  contentDiv.classList.add("nr-page-content");
  pageShell.appendChild(contentDiv);

  await MarkdownRenderer.render(app, bodyMarkdown, contentDiv, sourcePath, parentComponent);

  // Wait for layout
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));

  // Paginate
  const pageData = paginateBody(contentDiv);

  // Build page elements
  const pageElements = pageData.map((page, idx) => {
    const pageDiv = document.createElement("div");
    pageDiv.classList.add("nr-page", "nr-page-body");
    pageDiv.dataset.pageIndex = String(idx + 1); // +1 because cover is 0

    pageDiv.style.cssText = `
      width: ${PAGE_WIDTH}px;
      height: ${PAGE_HEIGHT}px;
      padding: ${PAGE_PADDING}px;
      box-sizing: border-box;
      overflow: hidden;
      position: relative;
    `;

    const pageStyle = document.createElement("style");
    pageStyle.textContent = templateCss;
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
