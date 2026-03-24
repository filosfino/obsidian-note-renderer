// ── Font management ──────────────────────────────────────────────────────────

export interface FontEntry {
  label: string;
  value: string;
}

// ── queryLocalFonts type declaration ─────────────────────────────────────────

interface FontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
}

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<FontData[]>;
  }
}

// ── Default fonts (cross-platform system fonts only) ─────────────────────────

export const DEFAULT_FONTS: FontEntry[] = [
  // ── 黑体 ──
  { label: "苹方/雅黑", value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: "冬青黑", value: '"Hiragino Sans GB", "PingFang SC", sans-serif' },
  { label: "思源黑体", value: '"Source Han Sans SC", "Noto Sans SC", sans-serif' },
  // ── 宋体 ──
  { label: "宋体", value: '"Songti SC", "SimSun", serif' },
  { label: "思源宋体", value: '"Noto Serif SC", "Songti SC", serif' },
  // ── 楷体/仿宋 ──
  { label: "楷体", value: '"Kaiti SC", "STKaiti", serif' },
  { label: "仿宋", value: '"STFangsong", "FangSong", serif' },
  // ── 圆体/手写 ──
  { label: "圆体", value: '"Yuanti SC", "PingFang SC", sans-serif' },
  { label: "娃娃体", value: '"Wawati SC", "PingFang SC", sans-serif' },
  { label: "手札体", value: '"Hannotate SC", "PingFang SC", sans-serif' },
  // ── 开源字体 ──
  { label: "霞鹜文楷", value: '"LXGW WenKai", "Kaiti SC", serif' },
  // ── 书法 ──
  { label: "行楷", value: '"Xingkai SC", "STXingkai", serif' },
  // ── 系统 ──
  { label: "系统默认", value: '-apple-system, "PingFang SC", sans-serif' },
];

// ── Chinese font name mapping (machine name → human name) ────────────────────
// Fonts in this map are classified as "中文字体", everything else as "其他字体"

export const CHINESE_FONT_MAP: Record<string, string> = {
  // ── macOS 系统字体 ──
  "PingFang SC": "苹方-简",
  "PingFang TC": "苹方-繁",
  "PingFang HK": "苹方-港",
  "Songti SC": "宋体-简",
  "Songti TC": "宋体-繁",
  "Kaiti SC": "楷体-简",
  "Kaiti TC": "楷体-繁",
  "Yuanti SC": "圆体-简",
  "Yuanti TC": "圆体-繁",
  "Xingkai SC": "行楷-简",
  "Xingkai TC": "行楷-繁",
  "Wawati SC": "娃娃体-简",
  "Wawati TC": "娃娃体-繁",
  "Weibei SC": "魏碑-简",
  "Weibei TC": "魏碑-繁",
  "Yuppy SC": "雅痞-简",
  "Yuppy TC": "雅痞-繁",
  "Baoli SC": "报隶-简",
  "Baoli TC": "报隶-繁",
  "Libian SC": "隶变-简",
  "Libian TC": "隶变-繁",
  "Hannotate SC": "手札体-简",
  "Hannotate TC": "手札体-繁",
  "HanziPen SC": "翩翩体-简",
  "HanziPen TC": "翩翩体-繁",
  "Lantinghei SC": "兰亭黑-简",
  "Lantinghei TC": "兰亭黑-繁",
  "Hiragino Sans GB": "冬青黑-简",
  "Heiti SC": "黑体-简",
  "Heiti TC": "黑体-繁",
  "STHeiti": "华文黑体",
  "STKaiti": "华文楷体",
  "STSong": "华文宋体",
  "STFangsong": "华文仿宋",
  "STXihei": "华文细黑",
  "STXingkai": "华文行楷",
  "STZhongsong": "华文中宋",
  "STLiti": "华文隶书",
  // ── Windows 系统字体 ──
  "Microsoft YaHei": "微软雅黑",
  "Microsoft JhengHei": "微软正黑",
  "SimSun": "中易宋体",
  "NSimSun": "新宋体",
  "SimHei": "中易黑体",
  "FangSong": "仿宋",
  "KaiTi": "楷体",
  "LiSu": "隶书",
  "YouYuan": "幼圆",
  "SimLi": "简隶",
  "DengXian": "等线",
  // ── 思源系列 ──
  "Source Han Sans SC": "思源黑体-简",
  "Source Han Sans TC": "思源黑体-繁",
  "Source Han Sans SC Heavy": "思源黑体-简 Heavy",
  "Source Han Sans SC Medium": "思源黑体-简 Medium",
  "Source Han Serif SC": "思源宋体-简",
  "Source Han Serif TC": "思源宋体-繁",
  "Noto Sans SC": "Noto 黑体-简",
  "Noto Sans TC": "Noto 黑体-繁",
  "Noto Serif SC": "Noto 宋体-简",
  "Noto Serif TC": "Noto 宋体-繁",
  // ── 霞鹜系列 ──
  "LXGW WenKai": "霞鹜文楷",
  "LXGW WenKai GB": "霞鹜文楷 GB",
  "LXGW WenKai Mono": "霞鹜文楷 Mono",
  "LXGW Bright": "霞鹜 Bright",
  "LXGW Neo XiHei": "霞鹜新晰黑",
  "LXGW Neo ZhiSong": "霞鹜新致宋",
  "LXGW Heart Serif": "霞鹜铭心宋",
  "LXGW Fasmart Gothic": "霞鹜尚智黑",
  "LXGW Marker Gothic": "霞鹜漫黑",
  // ── 方正系列 ──
  "FZShuSong-Z01S": "方正书宋",
  "FZDaBiaoSong-B06S": "方正大标宋",
  "FZCuSong-B09S": "方正粗宋",
  "FZYaSongS-R-GB": "方正标雅宋",
  "FZYaSongS-L-GB": "方正细雅宋",
  "FZYaSongS-EL-GB": "方正纤雅宋",
  "FZPingXianYaSongS-R-GB": "方正屏显雅宋",
  "FZLanTingHeiS-R-GB": "方正兰亭黑",
  "FZLanTingYuanS-L-GB": "方正兰亭圆",
  "FZCuYuan-M03S": "方正粗圆",
  "FZKai-Z03S": "方正楷体",
  "FZNewKai-Z03S": "方正新楷体",
  "FZFangSong-Z02S": "方正仿宋",
  "FZKeBenFangSongS-R-GB": "方正刻本仿宋",
  "FZFW ZhuZi HeiS B": "方正筑紫黑 B",
  "FZFW ZhuZi HeiS R": "方正筑紫黑 R",
  "FZFW ZhuZi HeiS M": "方正筑紫黑 M",
  "FZFW ZhuZi MinchoS L": "方正筑紫明朝",
  "FZFW ZhuZi A Old Mincho R": "方正筑紫A老明朝",
  "FZShengShiKaiShuS-EB-GB": "方正盛世楷书",
  "FZBeiWeiKaiShu-Z15S": "方正北魏楷书",
  "FZZhongYaoXiaoKaiS": "方正钟繇小楷",
  "FZKaTong-M19S": "方正卡通",
  "FZYouHeiS 508R": "方正悠黑",
  "FZFW ZhenZhuTiS L": "方正珍珠体",
  "FZChunWanLMJSTS": "方正春晚龙马",
  "FZXS12": "方正像素12",
  // ── 汉仪系列 ──
  "HYQiHei 55S": "汉仪旗黑 55S",
  "HYQiHei 65S": "汉仪旗黑 65S",
  "HYQiHei 85S": "汉仪旗黑 85S",
  "HYQiHei 95S": "汉仪旗黑 95S",
  "HYQiHei": "汉仪旗黑",
  // ── 字魂系列 ──
  "zihunzhenhunshoushu": "字魂镇魂手书",
  "zixiaohunfuyaoshoushu": "字小魂扶摇手书",
  "zihunshuiyunxingkai": "字魂水云行楷",
  "zihunxiangsimingyuekai": "字魂相思明月楷",
  "zihunbaigetianxingti": "字魂白鸽天行",
  "zihunxianjianqixiati": "字魂仙剑奇侠",
};

export type FontCategory = "chinese-sc" | "chinese-tc" | "chinese-other" | "other";

// Suffixes that indicate Simplified Chinese
const SC_SUFFIXES = [" SC", "-SC", "-GB", "S-R-GB", "S-L-GB", "S-EL-GB", "S-EB-GB", "S-B-GB", "S-M-GB"];
// Suffixes that indicate Traditional Chinese
const TC_SUFFIXES = [" TC", "-TC", " HK", "-HK"];

/** Classify a font family into a category */
export function getFontCategory(family: string): FontCategory {
  if (!(family in CHINESE_FONT_MAP)) return "other";
  const upper = family.toUpperCase();
  if (SC_SUFFIXES.some(s => upper.endsWith(s.toUpperCase()))) return "chinese-sc";
  if (TC_SUFFIXES.some(s => upper.endsWith(s.toUpperCase()))) return "chinese-tc";
  return "chinese-other";
}

/** Check if a font family name is a known Chinese font */
export function isChineseFont(family: string): boolean {
  return family in CHINESE_FONT_MAP;
}

/** Get display name for a font: Chinese name if known, otherwise the original family name */
export function getFontDisplayName(family: string): string {
  return CHINESE_FONT_MAP[family] ?? family;
}

/**
 * Deduplicate font families that are the same typeface at different weights.
 * e.g. "FZYaSongS-EL-GB", "FZYaSongS-L-GB", "FZYaSongS-R-GB" → keep only the first.
 * Also handles patterns like "Source Han Sans SC Heavy" / "Source Han Sans SC Medium".
 */
export function deduplicateFontFamilies(families: string[]): string[] {
  // Weight suffixes commonly appended to font family names
  const weightPatterns = [
    // Hyphenated weight codes: -EL-, -L-, -R-, -M-, -B-, -H-, -EB-, -DB-
    /-(?:EL|UL|L|R|M|DB|DM|B|EB|H|SB)-/i,
    // Trailing weight words: "Heavy", "Medium", "Light", "Bold", "Thin", "Regular", "Black"
    /\s+(?:Hairline|Thin|UltraLight|ExtraLight|Light|Regular|Medium|DemiBold|SemiBold|Bold|ExtraBold|UltraBold|Heavy|Black)\s*$/i,
    // Numbered weight variants: "55S", "65S", "85S", "95S" (e.g. HYQiHei)
    /\s+\d{2,3}S$/,
    // "508R" style (e.g. FZYouHeiS 508R)
    /\s+\d+[A-Z]$/,
  ];

  const normalize = (name: string): string => {
    let n = name;
    for (const pat of weightPatterns) {
      n = n.replace(pat, "§");  // Replace weight part with sentinel
    }
    return n;
  };

  const seen = new Set<string>();
  const result: string[] = [];

  for (const family of families) {
    const key = normalize(family);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(family);
    }
  }
  return result;
}

/** Build cover font list: defaults + custom + "同正文" sentinel */
export function getCoverFontList(customFonts: FontEntry[]): FontEntry[] {
  return [
    ...DEFAULT_FONTS,
    ...customFonts,
    { label: "同正文", value: "" },
  ];
}

/** Build body font list: defaults + custom */
export function getBodyFontList(customFonts: FontEntry[]): FontEntry[] {
  return [...DEFAULT_FONTS, ...customFonts];
}
