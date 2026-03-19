import { App, MarkdownRenderer, Component } from "obsidian";
import { PAGE_WIDTH, PAGE_HEIGHT, PAGE_PADDING } from "./constants";
import { paginate, Page } from "./paginator";

export interface RenderedPages {
  pages: HTMLElement[];
  cleanup: () => void;
}

/**
 * Render a markdown string into paginated page elements.
 *
 * Flow: MD → Obsidian MarkdownRenderer → measure in hidden container → paginate → page divs
 */
export async function renderNote(
  app: App,
  markdown: string,
  sourcePath: string,
  templateCss: string,
  parentComponent: Component
): Promise<RenderedPages> {
  // 1. Create a hidden measuring container at full resolution
  const measurer = document.createElement("div");
  measurer.classList.add("nr-measurer");
  measurer.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: ${PAGE_WIDTH}px;
    padding: ${PAGE_PADDING}px;
    font-size: 16px;
    line-height: 1.8;
    box-sizing: border-box;
  `;
  document.body.appendChild(measurer);

  // Apply template CSS via a scoped style element
  const styleEl = document.createElement("style");
  styleEl.textContent = templateCss;
  measurer.appendChild(styleEl);

  // 2. Render markdown into the measurer
  const contentDiv = document.createElement("div");
  contentDiv.classList.add("nr-content");
  measurer.appendChild(contentDiv);

  await MarkdownRenderer.render(app, markdown, contentDiv, sourcePath, parentComponent);

  // Wait a frame for images to load and layout to settle
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));

  // 3. Paginate
  const pageData = paginate(contentDiv);

  // 4. Build page elements
  const pageElements = pageData.map((page, idx) => {
    const pageDiv = document.createElement("div");
    pageDiv.classList.add("nr-page");
    if (page.isTitle) pageDiv.classList.add("nr-page-title");
    pageDiv.dataset.pageIndex = String(idx);

    pageDiv.style.cssText = `
      width: ${PAGE_WIDTH}px;
      height: ${PAGE_HEIGHT}px;
      padding: ${PAGE_PADDING}px;
      box-sizing: border-box;
      overflow: hidden;
      position: relative;
    `;

    // Clone the template style for each page
    const pageStyle = styleEl.cloneNode(true);
    pageDiv.appendChild(pageStyle);

    const pageContent = document.createElement("div");
    pageContent.classList.add("nr-page-content");
    if (page.isTitle) {
      pageContent.classList.add("nr-title-content");
    }

    for (const el of page.elements) {
      pageContent.appendChild(el.cloneNode(true));
    }

    pageDiv.appendChild(pageContent);
    return pageDiv;
  });

  const cleanup = () => {
    measurer.remove();
  };

  return { pages: pageElements, cleanup };
}
