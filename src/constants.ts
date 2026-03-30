// Xiaohongshu image dimensions
export const PAGE_WIDTH = 1080;
export const PAGE_PADDING_H = 90;    // left/right
export const PAGE_PADDING_TOP = 120; // top — more breathing room
export const PAGE_PADDING_BOTTOM = 90; // bottom — slightly tighter
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_PADDING_H * 2;

// Page aspect ratios
export type PageMode = "long" | "card";
export const PAGE_HEIGHTS: Record<PageMode, number> = {
  long: 1800,  // 3:5 — 长文多页排版
  card: 1440,  // 3:4 — 图文笔记
};

export function getContentHeight(mode: PageMode): number {
  return PAGE_HEIGHTS[mode] - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
}

// Legacy defaults (used where mode is not yet threaded through)
export const PAGE_HEIGHT = 1800;
export const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;

// Cover stroke styles for text-on-image
export type CoverStrokeStyle = "none" | "stroke" | "double" | "hollow";

// Cover text alignment
export type CoverTextAlign = "left" | "center" | "right";

export const VIEW_TYPE = "note-renderer-preview";
