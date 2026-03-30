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
export type ThemeColorValues = Partial<Record<ThemeColorKey, string>>;

export const BUILT_IN_THEME_COLOR_TOKENS = {
  amber: {
    background: "#2d2b29",
    bodyText: "#e0d6c8",
    title: "#f0d472",
    highlight: "rgba(240,212,114,0.25)",
    blockquoteText: "#c0b8a8",
    blockquoteBorder: "#f0d472",
    inlineCodeText: "#d4956a",
    inlineCodeBackground: "#3a3630",
    codeBlockBackground: "#3a3630",
    strongText: "#f0d472",
    coverImageTitle: "#fff",
  },
  cream: {
    background: "#f8f4ef",
    bodyText: "#2d2a26",
    title: "#a04830",
    highlight: "rgba(160,72,48,0.25)",
    blockquoteText: "#6b635a",
    blockquoteBorder: "#e07c5a",
    inlineCodeText: "#c75050",
    inlineCodeBackground: "#efe9e0",
    codeBlockBackground: "#efe9e0",
    strongText: "#e07c5a",
    coverImageTitle: "#fff",
  },
  graphite: {
    background: "#3a3a3a",
    bodyText: "#e0e0e0",
    title: "#fff",
    highlight: "rgba(255,255,255,0.15)",
    blockquoteText: "#bbb",
    blockquoteBorder: "#555",
    inlineCodeText: "#eb5757",
    inlineCodeBackground: "#2e2e2e",
    codeBlockBackground: "#2e2e2e",
    strongText: "#fff",
    coverImageTitle: "#fff",
  },
  "ink-gold": {
    background: "#333",
    bodyText: "#d4d4d4",
    title: "#f5d040",
    highlight: "rgba(245,208,64,0.25)",
    blockquoteText: "#bbb",
    blockquoteBorder: "#e8c36a",
    inlineCodeText: "#d4956a",
    inlineCodeBackground: "#2a2a2a",
    codeBlockBackground: "#2a2a2a",
    strongText: "#e8c36a",
    coverImageTitle: "#fff",
  },
  latte: {
    background: "#f5ede8",
    bodyText: "#5a4a42",
    title: "#6d4a2e",
    highlight: "rgba(109,74,46,0.20)",
    blockquoteText: "#7a6b60",
    blockquoteBorder: "#a17453",
    inlineCodeText: "#965454",
    inlineCodeBackground: "#ece4dd",
    codeBlockBackground: "#ece4dd",
    strongText: "#a17453",
    coverImageTitle: "#fff",
  },
  mist: {
    background: "#e4eaf0",
    bodyText: "#4a5565",
    title: "#354d68",
    highlight: "rgba(53,77,104,0.20)",
    blockquoteText: "#6b7585",
    blockquoteBorder: "#8696a7",
    inlineCodeText: "#7a6b8a",
    inlineCodeBackground: "#dce2e9",
    codeBlockBackground: "#dce2e9",
    strongText: "#8696a7",
    coverImageTitle: "#fff",
  },
  paper: {
    background: "#fff",
    bodyText: "#1a1a1a",
    title: "#1a1a1a",
    highlight: "rgba(26,26,26,0.12)",
    blockquoteText: "#555",
    blockquoteBorder: "#e0e0e0",
    inlineCodeText: "#eb5757",
    inlineCodeBackground: "#f5f0eb",
    codeBlockBackground: "#f5f5f5",
    coverImageTitle: "#fff",
  },
  rose: {
    background: "#f5eaec",
    bodyText: "#6b5152",
    title: "#884040",
    highlight: "rgba(136,64,64,0.20)",
    blockquoteText: "#8a6b6d",
    blockquoteBorder: "#965454",
    inlineCodeText: "#8a6060",
    inlineCodeBackground: "#ece2e4",
    codeBlockBackground: "#ece2e4",
    strongText: "#965454",
    coverImageTitle: "#fff",
  },
  sage: {
    background: "#e8ede6",
    bodyText: "#4a5548",
    title: "#3f5435",
    highlight: "rgba(63,84,53,0.20)",
    blockquoteText: "#6b7a60",
    blockquoteBorder: "#7b8b6f",
    inlineCodeText: "#6b7a5e",
    inlineCodeBackground: "#dfe5dc",
    codeBlockBackground: "#dfe5dc",
    strongText: "#7b8b6f",
    coverImageTitle: "#fff",
  },
} as const satisfies Record<string, ThemeColorValues>;

export function getBuiltInThemeColorValues(themeName?: string): ThemeColorValues | null {
  if (!themeName) return null;
  return BUILT_IN_THEME_COLOR_TOKENS[themeName as keyof typeof BUILT_IN_THEME_COLOR_TOKENS] ?? null;
}

function pick(themeCss: string, pattern: RegExp): string {
  return themeCss.match(pattern)?.[1] ?? "";
}

function pickRgba(themeCss: string, pattern: RegExp): string {
  const match = themeCss.match(pattern)?.[1] ?? "";
  return match ? `rgba(${match})` : "";
}

export function extractCoverTitleColor(themeCss: string, themeName?: string): string {
  return getBuiltInThemeColorValues(themeName)?.title
    || pick(themeCss, /\.nr-cover-content\s+h1\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/);
}

export function extractPageBackgroundColor(themeCss: string, themeName?: string): string {
  return getBuiltInThemeColorValues(themeName)?.background
    || pick(themeCss, /\.nr-page\s*\{[^}]*background:\s*(#[0-9a-fA-F]{3,6})/);
}

export function extractBodyTextColor(themeCss: string, themeName?: string): string {
  return getBuiltInThemeColorValues(themeName)?.bodyText
    || pick(themeCss, /\.nr-page\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/);
}

export function extractThemeColorValues(themeCss: string, themeName?: string): ThemeColorValues {
  const tokens = getBuiltInThemeColorValues(themeName);
  if (tokens) return { ...tokens };
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

export function extractThemeColorChoices(themeCss: string, themeName?: string): ThemeColorChoice[] {
  const values = extractThemeColorValues(themeCss, themeName);
  const entries: ThemeColorChoice[] = [];
  for (const schema of THEME_COLOR_SCHEMAS) {
    const value = values[schema.key];
    if (!value) continue;
    if (entries.some((entry) => entry.label === schema.label && entry.value.toLowerCase() === value.toLowerCase())) continue;
    entries.push({ key: schema.key, label: schema.label, value });
  }
  return entries;
}

function parseHexBrightness(hexColor: string): boolean {
  const raw = hexColor.replace("#", "");
  const hex = raw.length === 3
    ? raw.split("").map((c) => c + c).join("")
    : raw;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

export function detectThemeBrightness(themeCss: string, themeName?: string): boolean {
  const background = getBuiltInThemeColorValues(themeName)?.background;
  if (background) return parseHexBrightness(background);
  const bgMatch = themeCss.match(/\.nr-page\s*\{[^}]*background:\s*#([0-9a-fA-F]{3,6})/);
  if (!bgMatch) return true;
  return parseHexBrightness(`#${bgMatch[1]}`);
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

export function deriveCoverStrokePalette(themeCss: string, themeName?: string): CoverStrokePalette {
  const isDark = detectThemeBrightness(themeCss, themeName);
  const fill = extractCoverTitleColor(themeCss, themeName) || (isDark ? "#ffffff" : "#1a1a1a");
  const background = extractPageBackgroundColor(themeCss, themeName) || (isDark ? "#303030" : "#f4efe6");
  return {
    fill,
    background,
    inner: mixHex(fill, background, 0.18),
    outer: mixHex(fill, background, 0.72),
  };
}
