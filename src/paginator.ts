import { CONTENT_HEIGHT as DEFAULT_CONTENT_HEIGHT } from "./constants";

export interface Page {
  elements: HTMLElement[];
  isCover: boolean;
}

/**
 * Get the full outer height of an element including margins.
 * getBoundingClientRect().height only returns border-box height,
 * missing margins which are significant for paragraph spacing.
 */
function outerHeight(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const marginTop = parseFloat(style.marginTop) || 0;
  const marginBottom = parseFloat(style.marginBottom) || 0;
  return rect.height + marginTop + marginBottom;
}

/**
 * Paginate rendered body HTML into pages.
 *
 * Rules:
 * - HR (`---`) forces a page break and is consumed
 * - Auto-break: when cumulative height exceeds CONTENT_HEIGHT,
 *   split at the previous element boundary
 * - Oversized single elements get their own page with CSS scaling
 */
export function paginateBody(container: HTMLElement, contentHeight: number = DEFAULT_CONTENT_HEIGHT): Page[] {
  const CONTENT_HEIGHT = contentHeight;
  const pages: Page[] = [];
  const children = Array.from(container.children) as HTMLElement[];

  let currentPage: HTMLElement[] = [];
  let currentHeight = 0;

  for (const el of children) {
    // Skip non-visible elements (frontmatter remnants, etc.)
    if (el.offsetHeight === 0) continue;

    // HR = forced page break
    if (el.tagName === "HR") {
      if (currentPage.length > 0) {
        pages.push({ elements: currentPage, isCover: false });
        currentPage = [];
        currentHeight = 0;
      }
      continue;
    }

    const elHeight = outerHeight(el);

    // Oversized element alone → own page
    if (elHeight > CONTENT_HEIGHT && currentPage.length === 0) {
      el.classList.add("nr-oversized");
      pages.push({ elements: [el], isCover: false });
      currentHeight = 0;
      continue;
    }

    // Would overflow → start new page
    if (currentHeight + elHeight > CONTENT_HEIGHT && currentPage.length > 0) {
      pages.push({ elements: currentPage, isCover: false });
      currentPage = [];
      currentHeight = 0;
    }

    currentPage.push(el);
    currentHeight += elHeight;
  }

  if (currentPage.length > 0) {
    pages.push({ elements: currentPage, isCover: false });
  }

  return pages;
}
