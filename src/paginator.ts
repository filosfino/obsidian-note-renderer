import { CONTENT_HEIGHT } from "./constants";

export interface Page {
  elements: HTMLElement[];
  isTitle: boolean;
}

/**
 * Takes a flat list of rendered HTML elements and splits them into pages.
 *
 * Rules:
 * - Page 0: title page (only the first H1 + optional subtitle)
 * - HR (`---`) forces a page break and is consumed (not rendered)
 * - Auto-break: when cumulative height exceeds CONTENT_HEIGHT, split at the
 *   previous element boundary
 * - Images that don't fit on the current page move to the next page whole;
 *   if taller than a full page, they get scaled down via CSS
 */
export function paginate(container: HTMLElement): Page[] {
  const pages: Page[] = [];
  const children = Array.from(container.children) as HTMLElement[];

  if (children.length === 0) return pages;

  // --- Title page ---
  const titleElements: HTMLElement[] = [];
  let startIdx = 0;

  // Collect leading H1 (and optional H2/subtitle) for title page
  for (let i = 0; i < children.length; i++) {
    const tag = children[i].tagName;
    if (i === 0 && (tag === "H1" || tag === "H2")) {
      titleElements.push(children[i]);
      startIdx = i + 1;
    } else if (i === 1 && titleElements.length === 1 && (tag === "H2" || tag === "P")) {
      titleElements.push(children[i]);
      startIdx = i + 1;
    } else {
      break;
    }
  }

  if (titleElements.length > 0) {
    pages.push({ elements: titleElements, isTitle: true });
  }

  // --- Content pages ---
  let currentPage: HTMLElement[] = [];
  let currentHeight = 0;

  for (let i = startIdx; i < children.length; i++) {
    const el = children[i];

    // HR = forced page break
    if (el.tagName === "HR") {
      if (currentPage.length > 0) {
        pages.push({ elements: currentPage, isTitle: false });
        currentPage = [];
        currentHeight = 0;
      }
      continue;
    }

    const elHeight = el.getBoundingClientRect().height;

    // Element alone is taller than a page → give it its own page (CSS will scale)
    if (elHeight > CONTENT_HEIGHT && currentPage.length === 0) {
      el.classList.add("nr-oversized");
      pages.push({ elements: [el], isTitle: false });
      currentHeight = 0;
      continue;
    }

    // Would overflow → start new page
    if (currentHeight + elHeight > CONTENT_HEIGHT && currentPage.length > 0) {
      pages.push({ elements: currentPage, isTitle: false });
      currentPage = [];
      currentHeight = 0;
    }

    currentPage.push(el);
    currentHeight += elHeight;
  }

  if (currentPage.length > 0) {
    pages.push({ elements: currentPage, isTitle: false });
  }

  return pages;
}
