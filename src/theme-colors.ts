export interface CoverStrokePalette {
  fill: string;
  inner: string;
  outer: string;
  background: string;
}

export interface ThemeColorChoice {
  key: ThemeColorKey;
  label: string;
  value: string;
}

export interface ThemeColorSchema {
  key: string;
  label: string;
  description: string;
}

export const THEME_COLOR_SCHEMAS = [
  { key: "background", label: "背景", description: "页面背景色（.nr-page background）" },
  { key: "bodyText", label: "正文", description: "页面正文文字色（.nr-page color）" },
  { key: "title", label: "标题", description: "封面标题文字色（.nr-cover-content h1 color）" },
  { key: "highlight", label: "高亮", description: "封面 mark 高亮底色" },
  { key: "blockquoteText", label: "引用", description: "正文引用文字色（blockquote color）" },
  { key: "blockquoteBorder", label: "引用线", description: "正文引用左边框颜色（blockquote border-left）" },
  { key: "inlineCodeText", label: "行内代码", description: "行内 code 文字色" },
  { key: "inlineCodeBackground", label: "代码底", description: "行内 code 背景色" },
  { key: "codeBlockBackground", label: "代码块底", description: "pre 代码块背景色" },
  { key: "strongText", label: "正文强调", description: "正文 strong 强调色" },
  { key: "coverImageTitle", label: "图片封面字", description: "封面图模式下的标题文字色" },
] as const satisfies readonly ThemeColorSchema[];

export type ThemeColorKey = typeof THEME_COLOR_SCHEMAS[number]["key"];

function pick(themeCss: string, pattern: RegExp): string {
  return themeCss.match(pattern)?.[1] ?? "";
}

function pickRgba(themeCss: string, pattern: RegExp): string {
  const match = themeCss.match(pattern)?.[1] ?? "";
  return match ? `rgba(${match})` : "";
}

export function extractCoverTitleColor(themeCss: string): string {
  return pick(themeCss, /\.nr-cover-content\s+h1\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/);
}

export function extractPageBackgroundColor(themeCss: string): string {
  return pick(themeCss, /\.nr-page\s*\{[^}]*background:\s*(#[0-9a-fA-F]{3,6})/);
}

export function extractBodyTextColor(themeCss: string): string {
  return pick(themeCss, /\.nr-page\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/);
}

export function extractThemeColorValues(themeCss: string): Partial<Record<ThemeColorKey, string>> {
  return {
    background: extractPageBackgroundColor(themeCss),
    bodyText: extractBodyTextColor(themeCss),
    title: extractCoverTitleColor(themeCss),
    highlight: pickRgba(themeCss, /\.nr-cover-content\s+mark\s*\{[^}]*rgba?\(([^)]+)\)/),
    blockquoteText: pick(themeCss, /\.nr-page-content\s+blockquote\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/),
    blockquoteBorder: pick(themeCss, /\.nr-page-content\s+blockquote\s*\{[^}]*border-left:\s*\d+px\s+solid\s+(#[0-9a-fA-F]{3,6})/),
    inlineCodeText: pick(themeCss, /\.nr-page-content\s+code\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/),
    inlineCodeBackground: pick(themeCss, /\.nr-page-content\s+code\s*\{[^}]*background:\s*(#[0-9a-fA-F]{3,6})/),
    codeBlockBackground: pick(themeCss, /\.nr-page-content\s+pre\s*\{[^}]*background:\s*(#[0-9a-fA-F]{3,6})/),
    strongText: pick(themeCss, /\.nr-page-content\s+strong\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/),
    coverImageTitle: pick(themeCss, /\.nr-cover-has-image\s+\.nr-cover-content\s+h1,[\s\S]*?color:\s*(#[0-9a-fA-F]{3,6})/),
  };
}

export function extractThemeColorChoices(themeCss: string): ThemeColorChoice[] {
  const values = extractThemeColorValues(themeCss);
  const entries: ThemeColorChoice[] = [];
  for (const schema of THEME_COLOR_SCHEMAS) {
    const value = values[schema.key];
    if (!value) continue;
    if (entries.some((entry) => entry.label === schema.label && entry.value.toLowerCase() === value.toLowerCase())) continue;
    entries.push({ key: schema.key, label: schema.label, value });
  }
  return entries;
}

export function detectThemeBrightness(themeCss: string): boolean {
  const bgMatch = themeCss.match(/\.nr-page\s*\{[^}]*background:\s*#([0-9a-fA-F]{3,6})/);
  if (!bgMatch) return true;
  const hex = bgMatch[1].length === 3
    ? bgMatch[1].split("").map((c) => c + c).join("")
    : bgMatch[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

function normalizeHex(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length === 3) {
    return raw.split("").map((c) => c + c).join("");
  }
  return raw;
}

function mixHex(a: string, b: string, ratio: number): string {
  const aa = normalizeHex(a);
  const bb = normalizeHex(b);
  const r = Math.round(parseInt(aa.slice(0, 2), 16) * (1 - ratio) + parseInt(bb.slice(0, 2), 16) * ratio);
  const g = Math.round(parseInt(aa.slice(2, 4), 16) * (1 - ratio) + parseInt(bb.slice(2, 4), 16) * ratio);
  const bl = Math.round(parseInt(aa.slice(4, 6), 16) * (1 - ratio) + parseInt(bb.slice(4, 6), 16) * ratio);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function deriveCoverStrokePalette(themeCss: string): CoverStrokePalette {
  const isDark = detectThemeBrightness(themeCss);
  const fill = extractCoverTitleColor(themeCss) || (isDark ? "#ffffff" : "#1a1a1a");
  const background = extractPageBackgroundColor(themeCss) || (isDark ? "#303030" : "#f4efe6");
  return {
    fill,
    background,
    inner: mixHex(fill, background, 0.18),
    outer: mixHex(fill, background, 0.72),
  };
}
