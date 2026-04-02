// Xiaohongshu image dimensions
const PAGE_PADDING_H_RATIO = 0.075;       // 90 / 1200
const PAGE_PADDING_TOP_RATIO = 0.075;     // 120 / 1600
const PAGE_PADDING_BOTTOM_RATIO = 0.05625; // 90 / 1600

// Page aspect ratios
export type PageMode = "long" | "card";
export const PAGE_SIZES: Record<PageMode, { width: number; height: number }> = {
  long: { width: 720, height: 1200 },  // 3:5 — 长文多页排版
  card: { width: 600, height: 800 },   // 3:4 — 图文笔记
};
export const PAGE_HEIGHTS: Record<PageMode, number> = {
  long: PAGE_SIZES.long.height,
  card: PAGE_SIZES.card.height,
};

export function getPageWidth(mode: PageMode): number {
  return PAGE_SIZES[mode].width;
}

export function getPagePaddingH(mode: PageMode): number {
  return Math.round(getPageWidth(mode) * PAGE_PADDING_H_RATIO);
}

export function getPagePaddingTop(mode: PageMode): number {
  return Math.round(PAGE_HEIGHTS[mode] * PAGE_PADDING_TOP_RATIO);
}

export function getPagePaddingBottom(mode: PageMode): number {
  return Math.round(PAGE_HEIGHTS[mode] * PAGE_PADDING_BOTTOM_RATIO);
}

export function getContentHeight(mode: PageMode): number {
  return PAGE_HEIGHTS[mode] - getPagePaddingTop(mode) - getPagePaddingBottom(mode);
}

export function getContentWidth(mode: PageMode): number {
  return getPageWidth(mode) - getPagePaddingH(mode) * 2;
}

// Legacy defaults (used where mode is not yet threaded through)
export const PAGE_WIDTH = PAGE_SIZES.long.width;
export const PAGE_HEIGHT = PAGE_SIZES.long.height;
export const PAGE_PADDING_H = getPagePaddingH("long");
export const PAGE_PADDING_TOP = getPagePaddingTop("long");
export const PAGE_PADDING_BOTTOM = getPagePaddingBottom("long");
export const CONTENT_WIDTH = getContentWidth("long");
export const CONTENT_HEIGHT = getContentHeight("long");

// Cover stroke styles for text-on-image
export type CoverStrokeStyle = "none" | "stroke" | "double" | "hollow";

// Cover text alignment
export type CoverTextAlign = "left" | "center" | "right";

export const VIEW_TYPE = "note-renderer-preview";
