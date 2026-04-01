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
  { label: "思源黑体", value: '"Source Han Sans SC", "Source Han Sans SC VF", "Noto Sans SC", "Noto Sans CJK SC", sans-serif' },
  // ── 宋体 ──
  { label: "宋体", value: '"Songti SC", "SimSun", serif' },
  { label: "思源宋体", value: '"Source Han Serif SC", "Source Han Serif SC VF", "Noto Serif SC", "Noto Serif CJK SC", "Songti SC", serif' },
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
  "Apple LiGothic Medium": "苹果俪中黑",
  "Apple LiSung Light": "苹果俪细宋",
  "LiHei Pro Medium": "俪黑 Pro",
  "LiSong Pro Light": "俪宋 Pro",
  "BiauKai": "标楷体",
  // ── 华文系列 ──
  "STHeiti": "华文黑体",
  "STXihei": "华文细黑",
  "STSong": "华文宋体",
  "STKaiti": "华文楷体",
  "STFangsong": "华文仿宋",
  "STZhongsong": "华文中宋",
  "STXingkai": "华文行楷",
  "STLiti": "华文隶书",
  "STCaiyun": "华文彩云",
  "STHupo": "华文琥珀",
  "STXinwei": "华文新魏",
  // ── Windows 系统字体 ──
  "Microsoft YaHei": "微软雅黑",
  "Microsoft YaHei UI": "微软雅黑 UI",
  "Microsoft JhengHei": "微软正黑",
  "Microsoft JhengHei UI": "微软正黑 UI",
  "SimSun": "宋体",
  "SimSun-ExtB": "宋体-ExtB",
  "NSimSun": "新宋体",
  "SimHei": "黑体",
  "FangSong": "仿宋",
  "FangSong_GB2312": "仿宋_GB2312",
  "KaiTi": "楷体",
  "KaiTi_GB2312": "楷体_GB2312",
  "LiSu": "隶书",
  "YouYuan": "幼圆",
  "SimLi": "简隶",
  "DengXian": "等线",
  "DengXian Light": "等线 Light",
  "MingLiU": "细明体",
  "PMingLiU": "新细明体",
  "MingLiU-ExtB": "细明体-ExtB",
  "PMingLiU-ExtB": "新细明体-ExtB",
  "MingLiU_HKSCS": "细明体_HKSCS",
  "DFKai-SB": "标楷体",
  // ── 思源/Adobe Source Han 系列 ──
  "Source Han Sans SC": "思源黑体-简",
  "Source Han Sans TC": "思源黑体-繁",
  "Source Han Sans HC": "思源黑体-港",
  "Source Han Sans SC VF": "思源黑体-简 VF",
  "Source Han Sans TC VF": "思源黑体-繁 VF",
  "Source Han Sans HW SC": "思源黑体-简 HW",
  "Source Han Sans HW TC": "思源黑体-繁 HW",
  "Source Han Serif SC": "思源宋体-简",
  "Source Han Serif TC": "思源宋体-繁",
  "Source Han Serif HC": "思源宋体-港",
  "Source Han Serif SC VF": "思源宋体-简 VF",
  "Source Han Serif TC VF": "思源宋体-繁 VF",
  // ── Google Noto CJK 系列 ──
  "Noto Sans SC": "Noto黑体-简",
  "Noto Sans TC": "Noto黑体-繁",
  "Noto Sans HK": "Noto黑体-港",
  "Noto Sans CJK SC": "Noto Sans CJK 简",
  "Noto Sans CJK TC": "Noto Sans CJK 繁",
  "Noto Sans CJK HK": "Noto Sans CJK 港",
  "Noto Serif SC": "Noto宋体-简",
  "Noto Serif TC": "Noto宋体-繁",
  "Noto Serif CJK SC": "Noto Serif CJK 简",
  "Noto Serif CJK TC": "Noto Serif CJK 繁",
  // ── 霞鹜系列 ──
  "LXGW WenKai": "霞鹜文楷",
  "LXGW WenKai GB": "霞鹜文楷 GB",
  "LXGW WenKai TC": "霞鹜文楷 TC",
  "LXGW WenKai Lite": "霞鹜文楷 轻便版",
  "LXGW WenKai Screen": "霞鹜文楷屏幕版",
  "LXGW WenKai Mono": "霞鹜文楷等宽",
  "LXGW WenKai Mono GB": "霞鹜文楷等宽 GB",
  "LXGW WenKai Mono TC": "霞鹜文楷等宽 TC",
  "LXGW WenKai Mono Lite": "霞鹜文楷等宽 轻便版",
  "LXGW Bright": "霞鹜 Bright",
  "LXGW Bright Code": "霞鹜 Bright Code",
  "LXGW Neo XiHei": "霞鹜新晰黑",
  "LXGW Neo ZhiSong": "霞鹜新致宋",
  "LXGW Heart Serif": "霞鹜铭心宋",
  "LXGW Fasmart Gothic": "霞鹜尚智黑",
  "LXGW Marker Gothic": "霞鹜漫黑",
  // ── 方正核心字体 ──
  "FZShuSong-Z01S": "方正书宋",
  "FZShuSong-Z01T": "方正书宋繁",
  "FZFangSong-Z02S": "方正仿宋",
  "FZKai-Z03S": "方正楷体",
  "FZHei-B01S": "方正黑体",
  "FZHei-B01T": "方正黑体繁",
  "FZDaBiaoSong-B06S": "方正大标宋",
  "FZXiaoBiaoSong-B05S": "方正小标宋",
  "FZCuSong-B09S": "方正粗宋",
  "FZBaoSong-Z04S": "方正报宋",
  "FZNewKai-Z03S": "方正新楷体",
  "FZCuYuan-M03S": "方正粗圆",
  "FZZhunYuan-M02S": "方正准圆",
  "FZXingKai-S04S": "方正行楷",
  "FZLiShu-S01S": "方正隶书",
  "FZHuPo-M04S": "方正琥珀",
  "FZShuTi-S05S": "方正舒体",
  "FZCuHei-B09S": "方正粗黑",
  "FZYiHei-M20S": "方正艺黑",
  "FZKaTong-M19S": "方正卡通",
  "FZWeiBei-S03S": "方正魏碑",
  // ── 方正兰亭系列 ──
  "FZLanTingHeiS-R-GB": "方正兰亭黑",
  "FZLanTingHeiS-L-GB": "方正兰亭黑_细",
  "FZLanTingHeiS-B-GB": "方正兰亭黑_粗",
  "FZLanTingHeiS-DB-GB": "方正兰亭黑_中粗",
  "FZLanTingHeiS-UL-GB": "方正兰亭黑_纤",
  "FZLanTingHeiS-EL-GB": "方正兰亭黑_纤细",
  "FZLanTingHeiS-EB-GB": "方正兰亭黑_特粗",
  "FZLanTingHeiS-H-GB": "方正兰亭黑_大粗",
  "FZLanTingYuanS-R-GB": "方正兰亭圆",
  "FZLanTingYuanS-L-GB": "方正兰亭圆_细",
  // ── 方正雅宋系列 ──
  "FZYaSongS-R-GB": "方正标雅宋",
  "FZYaSongS-L-GB": "方正细雅宋",
  "FZYaSongS-EL-GB": "方正纤雅宋",
  "FZYaSongS-B-GB": "方正粗雅宋",
  "FZPingXianYaSongS-R-GB": "方正屏显雅宋",
  // ── 方正筑紫系列 ──
  "FZFW ZhuZi HeiS": "方正筑紫黑",
  "FZFW ZhuZi HeiS R": "方正筑紫黑 R",
  "FZFW ZhuZi HeiS B": "方正筑紫黑 B",
  "FZFW ZhuZi HeiS M": "方正筑紫黑 M",
  "FZFW ZhuZi HeiS L": "方正筑紫黑 L",
  "FZFW ZhuZi HeiS D": "方正筑紫黑 D",
  "FZFW ZhuZi MinchoS": "方正筑紫明朝",
  "FZFW ZhuZi MinchoS L": "方正筑紫明朝 L",
  "FZFW ZhuZi A Old Mincho": "方正筑紫A老明朝",
  "FZFW ZhuZi A Old Mincho R": "方正筑紫A老明朝 R",
  "FZFW ZhuZi A Old Mincho L": "方正筑紫A老明朝 L",
  "FZFW ZhuZi A Old Mincho M": "方正筑紫A老明朝 M",
  "FZFW ZhuZi A Old Mincho D": "方正筑紫A老明朝 D",
  // ── 方正其他 ──
  "FZKeBenFangSongS-R-GB": "方正刻本仿宋",
  "FZShengShiKaiShuS-EB-GB": "方正盛世楷书",
  "FZBeiWeiKaiShu-Z15S": "方正北魏楷书",
  "FZZhongYaoXiaoKaiS": "方正钟繇小楷",
  "FZYouHeiS 508R": "方正悠黑",
  "FZFW ZhenZhuTiS L": "方正珍珠体",
  "FZChunWanLMJSTS": "方正春晚龙马",
  "FZXS12": "方正像素12",
  // ── 汉仪系列（现代命名）──
  "HYQiHei": "汉仪旗黑",
  "HYQiHei 25S": "汉仪旗黑 25S",
  "HYQiHei 35S": "汉仪旗黑 35S",
  "HYQiHei 45S": "汉仪旗黑 45S",
  "HYQiHei 55S": "汉仪旗黑 55S",
  "HYQiHei 65S": "汉仪旗黑 65S",
  "HYQiHei 75S": "汉仪旗黑 75S",
  "HYQiHei 85S": "汉仪旗黑 85S",
  "HYQiHei 95S": "汉仪旗黑 95S",
  "HYDaSongJ": "汉仪大宋简",
  "HYKaiti": "汉仪楷体",
  "HYYaKuHeiW": "汉仪雅酷黑W",
  "HYDaHeiJ": "汉仪大黑简",
  "HYShangWeiShouShuW": "汉仪尚魏手书W",
  "HYXiaoMaiTiJ": "汉仪小麦体简",
  "HYChengXingJ": "汉仪程行体简",
  "HYHeiLiZhiTiJ": "汉仪黑荔枝体简",
  "HYLeMiaoTi": "汉仪乐喵体",
  "HYPPTiJ": "汉仪PP体简",
  "HYJiaShuJ": "汉仪家书简",
  // ── 汉仪系列（传统命名 HYxxGJ）──
  "HYA1GJ": "汉仪书宋一简",
  "HYA2GJ": "汉仪报宋简",
  "HYA3GJ": "汉仪中宋简",
  "HYB1GJ": "汉仪中黑简",
  "HYB2GJ": "汉仪大黑简",
  "HYB9GJ": "汉仪粗黑简",
  "HYC1GJ": "汉仪楷体简",
  "HYC3GJ": "汉仪中楷简",
  "HYD1GJ": "汉仪仿宋简",
  "HYE1GJ": "汉仪细圆简",
  "HYE3GJ": "汉仪中圆简",
  "HYE4GJ": "汉仪粗圆简",
  "HYF1GJ": "汉仪大隶书简",
  "HYH1GJ": "汉仪魏碑简",
  "HYI1GJ": "汉仪行楷简",
  "HYI3GJ": "汉仪瘦金书简",
  "HYK1GJ": "汉仪综艺体简",
  "HYL1GJ": "汉仪彩云体简",
  "HYN1GJ": "汉仪舒同体简",
  // ── 字魂系列 ──
  "zihunzhenhunshoushu": "字魂镇魂手书",
  "zixiaohunfuyaoshoushu": "字小魂扶摇手书",
  "zihunshuiyunxingkai": "字魂水云行楷",
  "zihunxiangsimingyuekai": "字魂相思明月楷",
  "zihunbaigetianxingti": "字魂白鸽天行",
  "zihunxianjianqixiati": "字魂仙剑奇侠",
  "zihunshiguangjiyiti_trial": "字魂时光记忆体",
  // ── 科技公司字体 ──
  "MiSans": "小米MiSans",
  "MiSans VF": "小米MiSans VF",
  "MI Lan Pro VF": "小米兰亭Pro VF",
  "HarmonyOS Sans": "鸿蒙黑体",
  "HarmonyOS Sans SC": "鸿蒙黑体-简",
  "HarmonyOS Sans TC": "鸿蒙黑体-繁",
  "HarmonyOS Sans Condensed": "鸿蒙黑体窄",
  "Alibaba PuHuiTi": "阿里巴巴普惠体",
  "Alibaba PuHuiTi 2.0": "阿里巴巴普惠体 2.0",
  "Alibaba PuHuiTi 3.0": "阿里巴巴普惠体 3.0",
  "OPPO Sans": "OPPO Sans",
  "OPPO Sans 3.0": "OPPO Sans 3.0",
  "Honor Sans": "荣耀Sans",
  "Honor Sans CN": "荣耀Sans-简",
  // ── 文鼎系列 ──
  "AR PL UMing CN": "文鼎细上海宋-简",
  "AR PL UMing TW": "文鼎细上海宋-繁",
  "AR PL UMing HK": "文鼎细上海宋-港",
  "AR PL UKai CN": "文鼎中楷-简",
  "AR PL UKai TW": "文鼎中楷-繁",
  "AR PL UKai HK": "文鼎中楷-港",
  "AR PL New Sung": "文鼎新宋",
  // ── 文泉驿 ──
  "WenQuanYi Micro Hei": "文泉驿微米黑",
  "WenQuanYi Zen Hei": "文泉驿正黑",
  "WenQuanYi Micro Hei Mono": "文泉驿等宽微米黑",
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
