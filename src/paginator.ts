import { CONTENT_HEIGHT } from "./constants";

export interface Page {
  elements: HTMLElement[];
  isCover: boolean;
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
export function paginateBody(container: HTMLElement): Page[] {
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

    const elHeight = el.getBoundingClientRect().height;

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
