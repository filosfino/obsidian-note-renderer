/**
 * schema.ts — Config single source of truth.
 *
 * Every render parameter is defined here with its default value AND constraints.
 * UI, validation, and serialization all derive from this file.
 *
 * To add a new parameter:
 * 1. Add it to FIELD_SCHEMAS with default + constraints
 * 2. Done — RENDER_DEFAULTS, types, validation, UI constraints all auto-derive.
 *
 * To add a new cover effect:
 * 1. Add an entry to EFFECT_SCHEMAS
 * 2. Add rendering logic in effects.ts
 */

// ── Field schema types ──────────────────────────────────────────────────────

interface NumericField {
  type: "number";
  default: number;
  min: number;
  max: number;
  step?: number;       // default 1
  unit?: string;       // display unit: "%", "px", "em"
  description?: string;
  /** Transform internal value → display string. Default: String() */
  toDisplay?: (v: number) => string;
  /** Transform display string → internal value. Default: parseFloat() */
  fromDisplay?: (v: string) => number;
}

interface StringField {
  type: "string";
  default: string;
  enum?: readonly string[];  // constrained to these values
  description?: string;
}

interface BooleanField {
  type: "boolean";
  default: boolean;
  description?: string;
}

export function getDefaultCoverPaddingX(mode: "card" | "long"): number {
  return mode === "long" ? 48 : 40;
}

function normalizeLegacyCoverPaddingX(value: number, pageMode: "card" | "long"): number {
  return value === 90 ? getDefaultCoverPaddingX(pageMode) : value;
}

function getLongModeNumericDefault(key: string, cardValue: number): number {
  if (key === "coverPagePaddingX") return 48;
  if (key === "coverGlowSize") return 72;
  if (key === "coverShadowBlur") return 50;
  if (key === "coverShadowOffsetX") return 6;
  if (key === "coverShadowOffsetY") return 12;
  return cardValue;
}

function normalizeLegacyNumericDefault(key: string, value: number, pageMode: "card" | "long"): number {
  if (pageMode === "long") {
    if (key === "coverGlowSize" && value === 60) return 72;
    if (key === "coverShadowBlur" && value === 42) return 50;
    if (key === "coverShadowOffsetX" && value === 5) return 6;
    if (key === "coverShadowOffsetY" && value === 10) return 12;
  }
  return value;
}

function normalizeLegacyEffectDefault(
  pageMode: "card" | "long",
  scope: "coverEffects" | "bodyEffects",
  name: string,
  key: "width" | "spacing" | "size",
  value: number,
): number {
  if (pageMode === "long") {
    if (scope === "coverEffects") {
      if (name === "dots" && key === "spacing" && value === 28) return 34;
      if (name === "dots" && key === "size" && value === 4) return 5;
      if (name === "grid" && key === "spacing" && value === 60) return 72;
      if (name === "network" && key === "width" && value === 1) return 1.2;
    }
    if (scope === "bodyEffects") {
      if (name === "grid" && key === "spacing" && value === 64) return 76;
      if (name === "dots" && key === "spacing" && value === 32) return 38;
      if (name === "dots" && key === "size" && value === 3) return 4;
    }
  }

  if (scope === "coverEffects") {
    if (name === "dots" && key === "spacing" && value === 28) return 28;
    if (name === "dots" && key === "size" && value === 4) return 4;
    if (name === "grid" && key === "spacing" && value === 60) return 60;
    if (name === "network" && key === "width" && value === 1) return 1;
  }

  if (scope === "bodyEffects") {
    if (name === "grid" && key === "spacing" && value === 64) return 64;
    if (name === "dots" && key === "spacing" && value === 32) return 32;
    if (name === "dots" && key === "size" && value === 3) return 3;
  }

  return value;
}

export type FieldSchema = NumericField | StringField | BooleanField;

export const RENDERER_CONFIG_VERSION = 1;
export const RENDERER_CONFIG_VERSION_KEY = "rendererConfigVersion";

export interface StrokeControlSchema {
  default: number;
  min: number;
  max: number;
  step: number;
}

export interface StrokeStyleUiSchema {
  stroke: StrokeControlSchema;
  doubleStroke?: StrokeControlSchema;
  showOpacity: boolean;
}

// ── Field schema definitions ────────────────────────────────────────────────

export const BUILTIN_THEMES = [
  "paper", "graphite", "ink-gold", "amber", "cream", "latte", "sage", "mist", "rose",
] as const;

export const FIELD_SCHEMAS = {
  // ── Basic ──
  activeTheme:       { type: "string",  default: "mist", enum: BUILTIN_THEMES,
                       description: "配色主题。浅色：paper / cream / latte / sage / mist / rose；深色：graphite / ink-gold / amber。也可填自定义主题文件名（不含 .css）" } as StringField,
  fontSize:          { type: "number",  default: 28, min: 22, max: 30, step: 1, unit: "px",
                       description: "正文字号" } as NumericField,
  fontFamily:        { type: "string",  default: '"Source Han Sans SC", "PingFang SC", sans-serif',
                       description: "正文字体族，CSS font-family 格式" } as StringField,
  pageMode:          { type: "string",  default: "card", enum: ["long", "card"] as const,
                       description: "页面比例：long = 3:5，card = 3:4" } as StringField,
  listStyle:         { type: "string",  default: "default", enum: ["default", "capsule"] as const,
                       description: "列表样式：default = 常规列表，capsule = 胶囊卡片" } as StringField,
  coverMarkStyle:    { type: "string",  default: "marker", enum: ["marker", "block", "underline", "none"] as const,
                       description: "封面高亮样式：marker = 荧光笔，block = 底色块，underline = 底线，none = 不特殊处理" } as StringField,

  // ── Cover text ──
  coverFontFamily:   { type: "string",  default: '"Noto Serif SC", "Songti SC", serif',
                       description: "封面标题字体族" } as StringField,
  coverFontColor:    { type: "string",  default: "",
                       description: "封面标题颜色，留空则跟随主题；支持任意 CSS 颜色值" } as StringField,
  coverFontOpacity:  { type: "number",  default: 100, min: 0, max: 100, step: 10, unit: "%",
                       description: "封面标题整体透明度；同时作用于填充、描边、下划线和阴影" } as NumericField,
  coverFontScale:    { type: "number",  default: 100, min: 50, max: 300, step: 10, unit: "%",
                       description: "封面标题字号缩放比例" } as NumericField,
  coverFontWeight:   { type: "number",  default: 800, min: 100, max: 900, step: 100,
                       description: "封面标题字重（100 最细，900 最粗）" } as NumericField,
  coverLetterSpacing:{ type: "number",  default: 0, min: -5, max: 30,
                       description: "封面标题字间距（px）" } as NumericField,
  coverLineHeight:   { type: "number",  default: 1.5, min: 0.8, max: 2.5, step: 0.1,
                       description: "封面标题行高倍数",
                     } as NumericField,
  coverTextAlign:    { type: "string",  default: "left", enum: ["left", "center", "right"] as const,
                       description: "封面标题对齐方式" } as StringField,
  coverOffsetX:      { type: "number",  default: 0, min: -50, max: 50, unit: "%",
                       description: "封面标题水平偏移" } as NumericField,
  coverOffsetY:      { type: "number",  default: -5, min: -50, max: 50, unit: "%",
                       description: "封面标题垂直偏移" } as NumericField,
  coverPagePaddingX: { type: "number",  default: getDefaultCoverPaddingX("card"), min: 0, max: 180, step: 2, unit: "px",
                       description: "封面文字左右边距；0 表示铺满整页宽度" } as NumericField,

  // ── Cover text effects ──
  coverStrokeStyle:  { type: "string",  default: "none", enum: ["none", "stroke", "double", "hollow"] as const,
                       description: "封面标题描边样式。stroke = 单层描边，double = 内外双描边，hollow = 透明填充仅保留外轮廓" } as StringField,
  coverStrokePercent:{ type: "number",  default: 8, min: 0, max: 100, step: 0.5,
                       description: "主描边粗细（相对于字号的百分比）。double 模式下表示内描边，hollow 模式下表示镂空轮廓粗细" } as NumericField,
  coverStrokeOpacity:{ type: "number",  default: 34, min: 0, max: 100,
                       description: "描边不透明度。作用于描边层，不改变文字填充本身透明度；hollow 模式下通常隐藏" } as NumericField,
  coverStrokeColor:  { type: "string",  default: "",
                       description: "描边颜色，留空则跟随主题标题色；支持任意 CSS 颜色值" } as StringField,
  coverDoubleStrokePercent:{ type: "number",  default: 5, min: 0, max: 120, step: 0.5,
                       description: "第二层描边粗细（相对于字号的百分比，仅 double 生效）。表示外描边" } as NumericField,
  coverDoubleStrokeColor:{ type: "string",  default: "",
                       description: "第二层描边颜色，留空则跟随 theme 派生的外描边默认色；支持任意 CSS 颜色值" } as StringField,
  coverGlow:         { type: "boolean", default: false,
                       description: "封面标题是否显示发光。可与描边、投影、色带同时开启" } as BooleanField,
  coverGlowSize:     { type: "number",  default: 60, min: 0, max: 80, step: 2,
                       description: "发光效果半径" } as NumericField,
  coverGlowColor:    { type: "string",  default: "#a39152",
                       description: "发光颜色，留空则跟随文字颜色；支持任意 CSS 颜色值" } as StringField,
  coverShadow:       { type: "boolean", default: false,
                       description: "封面标题是否显示投影" } as BooleanField,
  coverShadowBlur:   { type: "number",  default: 42, min: 0, max: 200,
                       description: "标题投影模糊半径" } as NumericField,
  coverShadowOffsetX:{ type: "number",  default: 5, min: -100, max: 100,
                       description: "标题投影水平偏移" } as NumericField,
  coverShadowOffsetY:{ type: "number",  default: 10, min: -100, max: 100,
                       description: "标题投影垂直偏移" } as NumericField,
  coverShadowColor:  { type: "string",  default: "rgba(0,0,0,0.6)",
                       description: "标题投影颜色，支持任意 CSS 颜色值含 rgba" } as StringField,
  coverBanner:       { type: "boolean", default: false,
                       description: "封面是否显示斜条 banner 装饰" } as BooleanField,
  coverBannerColor:  { type: "string",  default: "rgba(0,0,0,0.5)",
                       description: "banner 颜色，支持 CSS 颜色值含 rgba" } as StringField,
  coverBannerSkew:   { type: "number",  default: 4, min: 0, max: 20,
                       description: "banner 倾斜角度（度）" } as NumericField,
  coverBannerPaddingPercent: { type: "number", default: 40, min: 0, max: 120, step: 5, unit: "%",
                       description: "banner 左右额外留白，按当前字号的百分比计算" } as NumericField,
} as const satisfies Record<string, FieldSchema>;

export const COVER_STROKE_STYLE_UI: Record<"none" | "stroke" | "double" | "hollow", StrokeStyleUiSchema> = {
  none: {
    stroke: { default: 9, min: 0, max: 100, step: 0.5 },
    showOpacity: false,
  },
  stroke: {
    stroke: { default: 9, min: 0, max: 100, step: 0.5 },
    showOpacity: true,
  },
  double: {
    stroke: { default: 8, min: 0, max: 100, step: 0.5 },
    doubleStroke: { default: 5, min: 0, max: 120, step: 0.5 },
    showOpacity: true,
  },
  hollow: {
    stroke: { default: 1, min: 0, max: 2, step: 0.2 },
    showOpacity: false,
  },
};

/** Lookup field schema by key. Returns undefined for unknown keys. */
export function getFieldSchema(key: string): FieldSchema | undefined {
  return (FIELD_SCHEMAS as Record<string, FieldSchema>)[key];
}

// ── Effect schema ───────────────────────────────────────────────────────────

export interface EffectParams {
  enabled: boolean;
  opacity: number;
  mode?: string;
  shape?: string;
  count?: number;
  width?: number;
  spacing?: number;
  size?: number;
  color?: string;
}

export interface EffectModeOption {
  value: string;
  label: string;
}

export interface EffectSchema {
  label: string;
  description?: string;
  defaultEnabled: boolean;
  defaultOpacity: number;
  min: number;
  max: number;
  /** Mode parameter — for effects with a small set of named variants. */
  defaultMode?: string;
  modeOptions?: EffectModeOption[];
  /** Shape parameter — for effects with a small set of visual silhouettes. */
  defaultShape?: string;
  shapeOptions?: EffectModeOption[];
  /** Count parameter — only for effects with discrete elements. */
  defaultCount?: number;
  countMin?: number;
  countMax?: number;
  /** Width parameter — for effects whose line/stroke thickness is adjustable. */
  defaultWidth?: number;
  widthMin?: number;
  widthMax?: number;
  widthStep?: number;
  /** Spacing parameter — for effects whose repetition/gap is adjustable. */
  defaultSpacing?: number;
  spacingMin?: number;
  spacingMax?: number;
  spacingStep?: number;
  /** Size parameter — for effects whose element size should be adjustable. */
  defaultSize?: number;
  sizeMin?: number;
  sizeMax?: number;
  sizeStep?: number;
  /** Color parameter — for effects that support explicit tint overrides. */
  defaultColor?: string;
}

/** Effect definitions — single source of truth for defaults + UI constraints. 仅作用于封面页。 */
export const EFFECT_SCHEMAS: Record<string, EffectSchema> = {
  overlay:   { label: "遮罩",   description: "封面特效。纯色半透明遮罩，压暗背景突出文字",
               defaultEnabled: false, defaultOpacity: 55, min: 0,  max: 100 },
  vignette:  { label: "暗角",   description: "封面特效。四角渐暗，模拟镜头暗角",
               defaultEnabled: false, defaultOpacity: 50, min: 0,  max: 100 },
  grain:     { label: "噪点",   description: "封面特效。胶片颗粒质感",
               defaultEnabled: false, defaultOpacity: 50, min: 1,  max: 50 },
  aurora:    { label: "极光",   description: "封面特效。彩色光带，count 控制光带数量",
               defaultEnabled: false, defaultOpacity: 30, min: 5,  max: 80, defaultCount: 3,  countMin: 2, countMax: 6 },
  bokeh:     { label: "散景",   description: "封面特效。虚化光斑，count 控制光斑数量",
               defaultEnabled: false, defaultOpacity: 12, min: 1,  max: 50, defaultCount: 16, countMin: 4, countMax: 40, defaultColor: "" },
  dots:      { label: "波点",   description: "封面特效。规则点阵，像画画笔记本的点阵纸",
               defaultEnabled: false, defaultOpacity: 10, min: 1,  max: 40,
               defaultSpacing: 28, spacingMin: 16, spacingMax: 64, spacingStep: 2,
               defaultSize: 4, sizeMin: 1, sizeMax: 12, sizeStep: 1,
               defaultColor: "" },
  grid:      { label: "网格",   description: "封面特效。细线网格纹理",
               defaultEnabled: false, defaultOpacity: 36, min: 1,  max: 50,
               defaultSpacing: 60, spacingMin: 24, spacingMax: 140, spacingStep: 4 },
  dappledLight: {
               label: "斑驳光影",
               description: "封面特效。模拟窗边投射进来的柔和光影，mode 可切换晴天 / 雨天 / 月光氛围",
               defaultEnabled: false,
               defaultOpacity: 32,
               min: 5,
               max: 70,
               defaultMode: "sunny",
               defaultShape: "broad",
               modeOptions: [
                 { value: "sunny", label: "晴天" },
                 { value: "rainy", label: "雨天" },
                 { value: "moonlight", label: "月光" },
               ],
               shapeOptions: [
                 { value: "broad", label: "阔叶" },
                 { value: "branch", label: "枝影" },
                 { value: "palm", label: "棕榈" },
               ],
  },
  lightLeak: { label: "漏光",   description: "封面特效。模拟胶片漏光，count 控制漏光区域数",
               defaultEnabled: false, defaultOpacity: 25, min: 5,  max: 80, defaultCount: 2,  countMin: 1, countMax: 5 },
  scanlines: { label: "扫描线", description: "封面特效。水平扫描线，CRT 显示器风格",
               defaultEnabled: false, defaultOpacity: 27, min: 1,  max: 30 },
  network:   { label: "网络",   description: "封面特效。随机连线节点图案，count 控制节点数",
               defaultEnabled: false, defaultOpacity: 15, min: 5,  max: 50, defaultCount: 10, countMin: 4, countMax: 20,
               defaultWidth: 1, widthMin: 0.5, widthMax: 6, widthStep: 0.5 },
};

export const EFFECT_NAMES: string[] = Object.keys(EFFECT_SCHEMAS);
export const BODY_EFFECT_NAMES = ["grid", "dots", "dappledLight", "network"] as const;
export type BodyEffectName = typeof BODY_EFFECT_NAMES[number];

// ── Derived: RENDER_DEFAULTS ────────────────────────────────────────────────

/** All render parameters with their default values — derived from FIELD_SCHEMAS + EFFECT_SCHEMAS. */
export const RENDER_DEFAULTS = {
  ...Object.fromEntries(
    Object.entries(FIELD_SCHEMAS).map(([key, schema]) => [key, schema.default])
  ),
  coverEffects: Object.fromEntries(
    Object.entries(EFFECT_SCHEMAS).map(([name, s]) => [name, {
      enabled: s.defaultEnabled,
      opacity: s.defaultOpacity,
      ...(s.defaultMode != null ? { mode: s.defaultMode } : {}),
      ...(s.defaultShape != null ? { shape: s.defaultShape } : {}),
      ...(s.defaultCount != null ? { count: s.defaultCount } : {}),
      ...(s.defaultWidth != null ? { width: s.defaultWidth } : {}),
      ...(s.defaultSpacing != null ? { spacing: s.defaultSpacing } : {}),
      ...(s.defaultSize != null ? { size: s.defaultSize } : {}),
      ...(s.defaultColor != null ? { color: s.defaultColor } : {}),
    }])
  ) as Record<string, EffectParams>,
  bodyEffects: Object.fromEntries(
    BODY_EFFECT_NAMES.map((name) => {
      const s = EFFECT_SCHEMAS[name];
      const bodyDefaults: Partial<EffectParams> = name === "grid"
        ? { opacity: 16, spacing: 64 }
        : name === "dots"
          ? { opacity: 8, spacing: 32, size: 3 }
          : name === "dappledLight"
            ? { opacity: 18, mode: "sunny", shape: "broad" }
            : name === "network"
              ? { opacity: 10, count: 8, width: 0.5 }
              : {};
      return [name, {
        enabled: false,
        opacity: bodyDefaults.opacity ?? s.defaultOpacity,
        ...(s.defaultMode != null ? { mode: bodyDefaults.mode ?? s.defaultMode } : {}),
        ...(s.defaultShape != null ? { shape: bodyDefaults.shape ?? s.defaultShape } : {}),
        ...(s.defaultCount != null ? { count: bodyDefaults.count ?? s.defaultCount } : {}),
        ...(s.defaultWidth != null ? { width: bodyDefaults.width ?? s.defaultWidth } : {}),
        ...(s.defaultSpacing != null ? { spacing: bodyDefaults.spacing ?? s.defaultSpacing } : {}),
        ...(s.defaultSize != null ? { size: bodyDefaults.size ?? s.defaultSize } : {}),
        ...(s.defaultColor != null ? { color: s.defaultColor } : {}),
      }];
    })
  ) as Record<string, EffectParams>,
} as {
  // Explicit type for TS inference (Object.fromEntries loses key types)
  [K in keyof typeof FIELD_SCHEMAS]: (typeof FIELD_SCHEMAS)[K]["default"];
} & {
  coverEffects: Record<string, EffectParams>;
  bodyEffects: Record<string, EffectParams>;
};

export function getModeAwareRenderDefaults(mode: "card" | "long"): RenderOptions {
  if (mode === "card") {
    return {
      ...RENDER_DEFAULTS,
      coverEffects: Object.fromEntries(
        Object.entries(RENDER_DEFAULTS.coverEffects).map(([name, params]) => [name, { ...params }]),
      ) as Record<string, EffectParams>,
      bodyEffects: Object.fromEntries(
        Object.entries(RENDER_DEFAULTS.bodyEffects).map(([name, params]) => [name, { ...params }]),
      ) as Record<string, EffectParams>,
    };
  }

  return {
    ...RENDER_DEFAULTS,
    coverPagePaddingX: getLongModeNumericDefault("coverPagePaddingX", RENDER_DEFAULTS.coverPagePaddingX),
    coverGlowSize: getLongModeNumericDefault("coverGlowSize", RENDER_DEFAULTS.coverGlowSize),
    coverShadowBlur: getLongModeNumericDefault("coverShadowBlur", RENDER_DEFAULTS.coverShadowBlur),
    coverShadowOffsetX: getLongModeNumericDefault("coverShadowOffsetX", RENDER_DEFAULTS.coverShadowOffsetX),
    coverShadowOffsetY: getLongModeNumericDefault("coverShadowOffsetY", RENDER_DEFAULTS.coverShadowOffsetY),
    coverEffects: {
      ...Object.fromEntries(
        Object.entries(RENDER_DEFAULTS.coverEffects).map(([name, params]) => [name, { ...params }]),
      ) as Record<string, EffectParams>,
      dots: { ...RENDER_DEFAULTS.coverEffects.dots, spacing: 34, size: 5 },
      grid: { ...RENDER_DEFAULTS.coverEffects.grid, spacing: 72 },
      network: { ...RENDER_DEFAULTS.coverEffects.network, width: 1.2 },
    },
    bodyEffects: {
      ...Object.fromEntries(
        Object.entries(RENDER_DEFAULTS.bodyEffects).map(([name, params]) => [name, { ...params }]),
      ) as Record<string, EffectParams>,
      grid: { ...RENDER_DEFAULTS.bodyEffects.grid, spacing: 76 },
      dots: { ...RENDER_DEFAULTS.bodyEffects.dots, spacing: 38, size: 4 },
    },
  };
}

// ── Derived types ────────────────────────────────────────────────────────────

export type RenderOptions = typeof RENDER_DEFAULTS;
export type RenderKey = keyof RenderOptions;
export const RENDER_KEYS: RenderKey[] = Object.keys(RENDER_DEFAULTS) as RenderKey[];

export interface CoverTypographyConfig {
  fontFamily: string;
  color: string;
  opacity: number;
  scale: number;
  weight: number;
  letterSpacing: number;
  lineHeight: number;
  align: "left" | "center" | "right";
}

export interface CoverPositionConfig {
  offsetX: number;
  offsetY: number;
  paddingX: number;
}

export interface CoverStrokeLayerConfig {
  widthPercent: number;
  color: string;
}

export interface CoverStrokeConfig {
  style: "none" | "stroke" | "double" | "hollow";
  opacity: number;
  inner: CoverStrokeLayerConfig;
  outer: CoverStrokeLayerConfig;
}

export interface CoverGlowConfig {
  enabled: boolean;
  size: number;
  color: string;
}

export interface CoverShadowConfig {
  enabled: boolean;
  blur: number;
  offsetX: number;
  offsetY: number;
  color: string;
}

export interface CoverBannerConfig {
  enabled: boolean;
  color: string;
  skew: number;
  paddingPercent: number;
}

export interface CoverConfig {
  typography: CoverTypographyConfig;
  position: CoverPositionConfig;
  stroke: CoverStrokeConfig;
  glow: CoverGlowConfig;
  shadow: CoverShadowConfig;
  banner: CoverBannerConfig;
}

type CoverSemanticFieldPath = readonly [keyof CoverConfig, string] | readonly [keyof CoverConfig, string, string];

export interface SemanticFieldMeta {
  key: string;
  noteKey: string;
  description: string;
  uiLabel?: string;
  uiControl?: "color" | "number" | "select" | "toggle";
  uiOrder?: number;
  appliesWhen?: string;
  followsThemeWhenEmpty?: boolean;
  relatedFields?: readonly string[];
  examples?: readonly string[];
}

export interface SemanticGroupMeta {
  label: string;
  description: string;
  composition?: string;
  fields: Record<string, SemanticFieldMeta>;
}

export const COVER_SEMANTIC_SCHEMA = {
  typography: {
    label: "文字",
    description: "封面标题的基础排版样式。",
    composition: "定义封面标题本身的字体、填充和排版，不包含描边/发光/投影。",
    fields: {
      fontFamily: { key: "coverFontFamily", noteKey: "coverFontFamily", description: "封面标题字体族", uiLabel: "字体", uiControl: "select", uiOrder: 1, examples: ['"Yuanti SC", "PingFang SC", sans-serif'] },
      color: { key: "coverFontColor", noteKey: "coverFontColor", description: "封面标题填充色；留空时跟随主题标题色", uiLabel: "文字色", uiControl: "color", uiOrder: 2, followsThemeWhenEmpty: true, relatedFields: ["coverGlowColor", "coverStrokeColor"], examples: ["#111111", "#ffffff", ""] },
      opacity: { key: "coverFontOpacity", noteKey: "coverFontOpacity", description: "封面标题整体透明度", uiLabel: "透明", uiControl: "number", uiOrder: 3, examples: ["40", "70", "100"] },
      scale: { key: "coverFontScale", noteKey: "coverFontScale", description: "封面标题字号缩放比例", uiLabel: "缩放", uiControl: "number", uiOrder: 4, examples: ["100", "180", "240"] },
      weight: { key: "coverFontWeight", noteKey: "coverFontWeight", description: "封面标题字重", uiLabel: "字重", uiControl: "select", uiOrder: 5, examples: ["700", "800", "900"] },
      letterSpacing: { key: "coverLetterSpacing", noteKey: "coverLetterSpacing", description: "封面标题字间距", uiLabel: "间距", uiControl: "number", uiOrder: 6, examples: ["0", "5", "12"] },
      lineHeight: { key: "coverLineHeight", noteKey: "coverLineHeight", description: "封面标题行高", uiLabel: "行高", uiControl: "number", uiOrder: 7, examples: ["1.1", "1.3", "1.6"] },
      align: { key: "coverTextAlign", noteKey: "coverTextAlign", description: "封面标题对齐方式", uiLabel: "对齐", uiControl: "select", uiOrder: 8, examples: ["left", "center", "right"] },
    },
  },
  position: {
    label: "位置",
    description: "封面标题相对封面中心的偏移。",
    composition: "只影响封面标题块的位置，不改变页面整体布局。",
    fields: {
      offsetX: { key: "coverOffsetX", noteKey: "coverOffsetX", description: "水平偏移百分比", uiLabel: "X", uiControl: "number", uiOrder: 1, examples: ["-10", "0", "12"] },
      offsetY: { key: "coverOffsetY", noteKey: "coverOffsetY", description: "垂直偏移百分比", uiLabel: "Y", uiControl: "number", uiOrder: 2, examples: ["-8", "0", "10"] },
      paddingX: { key: "coverPagePaddingX", noteKey: "coverPagePaddingX", description: "封面页左右边距；0 表示铺满整页宽度，自动换行也会同步按可用宽度计算", uiLabel: "边距", uiControl: "number", uiOrder: 3, examples: ["0", "40", "45"] },
    },
  },
  stroke: {
    label: "描边",
    description: "封面标题描边系统，支持单描边、双描边和镂空。",
    composition: "double 表示内外双描边；hollow 表示透明填充，仅保留轮廓线。",
    fields: {
      style: { key: "coverStrokeStyle", noteKey: "coverStrokeStyle", description: "描边模式：none / stroke / double / hollow", uiLabel: "模式", uiControl: "select", uiOrder: 1, relatedFields: ["coverStrokePercent", "coverDoubleStrokePercent"], examples: ["stroke", "double", "hollow"] },
      opacity: { key: "coverStrokeOpacity", noteKey: "coverStrokeOpacity", description: "描边透明度；主要作用于描边层，不影响文字填充", uiLabel: "透明", uiControl: "number", uiOrder: 6, appliesWhen: "coverStrokeStyle != none && coverStrokeStyle != hollow", examples: ["60", "90", "100"] },
      innerWidth: { key: "coverStrokePercent", noteKey: "coverStrokePercent", description: "内描边粗度，相对字号的百分比", uiLabel: "内粗", uiControl: "number", uiOrder: 4, appliesWhen: "coverStrokeStyle in [stroke, double, hollow]", relatedFields: ["coverStrokeStyle", "coverStrokeColor"], examples: ["1", "5", "9"] },
      innerColor: { key: "coverStrokeColor", noteKey: "coverStrokeColor", description: "内描边颜色；留空时跟随当前 theme 派生色", uiLabel: "内色", uiControl: "color", uiOrder: 2, appliesWhen: "coverStrokeStyle in [stroke, double, hollow]", followsThemeWhenEmpty: true, relatedFields: ["coverFontColor", "coverDoubleStrokeColor"], examples: ["#ffffff", "#111111", ""] },
      outerWidth: { key: "coverDoubleStrokePercent", noteKey: "coverDoubleStrokePercent", description: "外描边粗度，仅 double 模式生效", uiLabel: "外粗", uiControl: "number", uiOrder: 5, appliesWhen: "coverStrokeStyle == double", relatedFields: ["coverStrokeStyle", "coverDoubleStrokeColor"], examples: ["3", "5", "10"] },
      outerColor: { key: "coverDoubleStrokeColor", noteKey: "coverDoubleStrokeColor", description: "外描边颜色，仅 double 模式生效；留空时跟随当前 theme 派生色", uiLabel: "外色", uiControl: "color", uiOrder: 3, appliesWhen: "coverStrokeStyle == double", followsThemeWhenEmpty: true, relatedFields: ["coverStrokeColor"], examples: ["#2b1a1a", "#000000", ""] },
    },
  },
  glow: {
    label: "发光",
    description: "封面标题发光效果，可与描边、投影叠加。",
    composition: "独立开关，不与描边或投影互斥。",
    fields: {
      enabled: { key: "coverGlow", noteKey: "coverGlow", description: "是否启用发光", uiLabel: "发光", uiControl: "toggle", uiOrder: 1, relatedFields: ["coverGlowSize", "coverGlowColor"], examples: ["true", "false"] },
      size: { key: "coverGlowSize", noteKey: "coverGlowSize", description: "发光强度", uiLabel: "光", uiControl: "number", uiOrder: 2, appliesWhen: "coverGlow == true", examples: ["20", "40", "60"] },
      color: { key: "coverGlowColor", noteKey: "coverGlowColor", description: "发光颜色；留空时跟随文字填充色", uiLabel: "发光色", uiControl: "color", uiOrder: 3, appliesWhen: "coverGlow == true", followsThemeWhenEmpty: true, relatedFields: ["coverFontColor"], examples: ["#ffcc66", "#ffffff", ""] },
    },
  },
  shadow: {
    label: "投影",
    description: "封面标题投影效果，可与描边、发光叠加。",
    composition: "独立开关，不与描边或发光互斥。",
    fields: {
      enabled: { key: "coverShadow", noteKey: "coverShadow", description: "是否启用投影", uiLabel: "投影", uiControl: "toggle", uiOrder: 1, relatedFields: ["coverShadowBlur", "coverShadowColor"], examples: ["true", "false"] },
      blur: { key: "coverShadowBlur", noteKey: "coverShadowBlur", description: "投影模糊半径", uiLabel: "模糊", uiControl: "number", uiOrder: 2, appliesWhen: "coverShadow == true", examples: ["8", "16", "32"] },
      offsetX: { key: "coverShadowOffsetX", noteKey: "coverShadowOffsetX", description: "投影水平偏移", uiLabel: "X", uiControl: "number", uiOrder: 4, appliesWhen: "coverShadow == true", examples: ["0", "2", "-2"] },
      offsetY: { key: "coverShadowOffsetY", noteKey: "coverShadowOffsetY", description: "投影垂直偏移", uiLabel: "Y", uiControl: "number", uiOrder: 5, appliesWhen: "coverShadow == true", examples: ["2", "4", "8"] },
      color: { key: "coverShadowColor", noteKey: "coverShadowColor", description: "投影颜色", uiLabel: "投影色", uiControl: "color", uiOrder: 3, appliesWhen: "coverShadow == true", relatedFields: ["coverShadowBlur"], examples: ["rgba(0,0,0,0.6)", "#000000"] },
    },
  },
  banner: {
    label: "色带",
    description: "封面标题背景色带效果。",
    composition: "在标题文字背后生成一条斜切背景带。",
    fields: {
      enabled: { key: "coverBanner", noteKey: "coverBanner", description: "是否启用色带", uiLabel: "色带", uiControl: "toggle", uiOrder: 1, relatedFields: ["coverBannerColor", "coverBannerSkew", "coverBannerPaddingPercent"], examples: ["true", "false"] },
      color: { key: "coverBannerColor", noteKey: "coverBannerColor", description: "色带颜色", uiLabel: "色带色", uiControl: "color", uiOrder: 2, appliesWhen: "coverBanner == true", examples: ["rgba(0,0,0,0.5)", "#222222"] },
      skew: { key: "coverBannerSkew", noteKey: "coverBannerSkew", description: "色带切角/倾斜度", uiLabel: "斜", uiControl: "number", uiOrder: 3, appliesWhen: "coverBanner == true", examples: ["4", "6", "10"] },
      paddingPercent: { key: "coverBannerPaddingPercent", noteKey: "coverBannerPaddingPercent", description: "色带左右额外留白，按当前字号百分比计算，值越大越不容易被斜角压到文字", uiLabel: "宽", uiControl: "number", uiOrder: 4, appliesWhen: "coverBanner == true", examples: ["20", "40", "60"] },
    },
  },
} as const satisfies Record<string, SemanticGroupMeta>;

const COVER_SEMANTIC_FIELD_PATHS: Record<string, CoverSemanticFieldPath> = {
  coverFontFamily: ["typography", "fontFamily"],
  coverFontColor: ["typography", "color"],
  coverFontOpacity: ["typography", "opacity"],
  coverFontScale: ["typography", "scale"],
  coverFontWeight: ["typography", "weight"],
  coverLetterSpacing: ["typography", "letterSpacing"],
  coverLineHeight: ["typography", "lineHeight"],
  coverTextAlign: ["typography", "align"],
  coverOffsetX: ["position", "offsetX"],
  coverOffsetY: ["position", "offsetY"],
  coverPagePaddingX: ["position", "paddingX"],
  coverStrokeStyle: ["stroke", "style"],
  coverStrokeOpacity: ["stroke", "opacity"],
  coverStrokePercent: ["stroke", "inner", "widthPercent"],
  coverStrokeColor: ["stroke", "inner", "color"],
  coverDoubleStrokePercent: ["stroke", "outer", "widthPercent"],
  coverDoubleStrokeColor: ["stroke", "outer", "color"],
  coverGlow: ["glow", "enabled"],
  coverGlowSize: ["glow", "size"],
  coverGlowColor: ["glow", "color"],
  coverShadow: ["shadow", "enabled"],
  coverShadowBlur: ["shadow", "blur"],
  coverShadowOffsetX: ["shadow", "offsetX"],
  coverShadowOffsetY: ["shadow", "offsetY"],
  coverShadowColor: ["shadow", "color"],
  coverBanner: ["banner", "enabled"],
  coverBannerColor: ["banner", "color"],
  coverBannerSkew: ["banner", "skew"],
  coverBannerPaddingPercent: ["banner", "paddingPercent"],
};

type CoverSemanticGroupKey = keyof typeof COVER_SEMANTIC_SCHEMA;
type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function evaluateSemanticCondition(expression: string, values: Record<string, unknown>): boolean {
  const inMatch = expression.match(/^(\w+)\s+in\s+\[([^\]]+)\]$/);
  if (inMatch) {
    const [, key, rawValues] = inMatch;
    const current = String(values[key] ?? "");
    const allowed = rawValues.split(",").map((part) => part.trim());
    return allowed.includes(current);
  }

  const eqMatch = expression.match(/^(\w+)\s*(==|!=)\s*(\w+)$/);
  if (eqMatch) {
    const [, key, op, rhs] = eqMatch;
    const current = String(values[key] ?? "");
    return op === "==" ? current === rhs : current !== rhs;
  }

  return true;
}

export function isCoverSemanticFieldActive<G extends CoverSemanticGroupKey>(
  group: G,
  field: string,
  values: Partial<RenderOptions>,
): boolean {
  const meta = (COVER_SEMANTIC_SCHEMA[group].fields as Record<string, SemanticFieldMeta>)[field];
  if (!meta.appliesWhen) return true;
  return evaluateSemanticCondition(meta.appliesWhen, values);
}

export function getCoverSemanticFieldMeta<G extends CoverSemanticGroupKey>(
  group: G,
  field: string,
): SemanticFieldMeta | null {
  return (COVER_SEMANTIC_SCHEMA[group].fields as Record<string, SemanticFieldMeta>)[field] ?? null;
}

function setNestedValue(target: PlainObject, path: readonly string[], value: unknown): void {
  let current: PlainObject = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const existing = current[key];
    if (!isPlainObject(existing)) {
      current[key] = {};
    }
    current = current[key] as PlainObject;
  }
  current[path[path.length - 1]] = value;
}

function getNestedValue(source: PlainObject, path: readonly string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (!isPlainObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

export function expandSemanticNoteConfig(raw: PlainObject): PlainObject {
  const result: PlainObject = { ...raw };
  const cover = raw.cover;
  if (isPlainObject(cover)) {
    const coverObject = cover;
    for (const [key, path] of Object.entries(COVER_SEMANTIC_FIELD_PATHS)) {
      const value = getNestedValue(coverObject, path as readonly string[]);
      if (value !== undefined) result[key] = value;
    }
    const effects = coverObject.effects;
    if (isPlainObject(effects)) {
      result.coverEffects = effects;
    }
  }
  const body = raw.body;
  if (isPlainObject(body)) {
    const effects = body.effects;
    if (isPlainObject(effects)) {
      result.bodyEffects = effects;
    }
  }
  return result;
}

// ── Key mapping ──────────────────────────────────────────────────────────────

export const NOTE_KEY_ALIASES: Record<string, RenderKey> = {
  theme: "activeTheme",
};

export const INTERNAL_TO_NOTE_KEY: Partial<Record<RenderKey, string>> = {
  activeTheme: "theme",
};

export function withRendererConfigVersion(config: PlainObject): PlainObject {
  return {
    [RENDERER_CONFIG_VERSION_KEY]: RENDERER_CONFIG_VERSION,
    ...config,
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate and normalize a raw note config object.
 * - Resolves key aliases
 * - Validates types and clamps numeric values to schema min/max
 * - Validates coverEffects/bodyEffects as nested objects
 * - Drops unknown keys
 */
export function validateNoteConfig(raw: PlainObject): Partial<RenderOptions> {
  const normalized = expandSemanticNoteConfig(raw);
  const pageMode = normalized.pageMode === "long" ? "long" : "card";
  const result: PlainObject = {};
  for (const [key, value] of Object.entries(normalized)) {
    if (value === undefined || value === null) continue;
    const canonicalKey = (NOTE_KEY_ALIASES[key] || key) as string;
    if (!(canonicalKey in RENDER_DEFAULTS)) continue;

    if (canonicalKey === "coverEffects" || canonicalKey === "bodyEffects") {
      if (isPlainObject(value)) {
        const allowedNames = canonicalKey === "coverEffects" ? EFFECT_NAMES : BODY_EFFECT_NAMES;
        const validated = validateEffectMap(value, allowedNames, pageMode, canonicalKey);
        if (Object.keys(validated).length > 0) {
          result[canonicalKey] = validated;
        }
      }
      continue;
    }

    const schema = getFieldSchema(canonicalKey);
    if (!schema) continue;
    if (typeof value !== schema.type) continue;

    // Clamp numeric values to schema range; apply fromDisplay if present (user writes display value)
    if (schema.type === "number" && typeof value === "number") {
      const internal = schema.fromDisplay ? schema.fromDisplay(String(value)) : value;
      const normalizedInternal = canonicalKey === "coverPagePaddingX"
        ? normalizeLegacyCoverPaddingX(internal, pageMode)
        : normalizeLegacyNumericDefault(canonicalKey, internal, pageMode);
      result[canonicalKey] = clampToSchema(normalizedInternal, schema);
    } else if (schema.type === "string" && schema.enum && typeof value === "string") {
      // Validate enum values
      if (schema.enum.includes(value)) {
        result[canonicalKey] = value;
      }
    } else {
      result[canonicalKey] = value;
    }
  }
  return result as Partial<RenderOptions>;
}

/** Clamp a numeric value to the schema's min/max range. */
export function clampToSchema(value: number, schema: NumericField): number {
  return Math.max(schema.min, Math.min(schema.max, value));
}

function validateEffectMap(
  raw: PlainObject,
  allowedNames: readonly string[],
  pageMode: "card" | "long",
  scope: "coverEffects" | "bodyEffects",
): Record<string, EffectParams> {
  const result: Record<string, EffectParams> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!allowedNames.includes(name)) continue;
    const schema = EFFECT_SCHEMAS[name];
    if (!schema) continue;
    if (!isPlainObject(value)) continue;
    const opacity = typeof value.opacity === "number"
      ? Math.max(schema.min, Math.min(schema.max, value.opacity))
      : schema.defaultOpacity;
    const params: EffectParams = {
      enabled: typeof value.enabled === "boolean" ? value.enabled : schema.defaultEnabled,
      opacity,
    };
    if (schema.defaultMode != null) {
      const rawMode = typeof value.mode === "string" ? value.mode : schema.defaultMode;
      const allowedModes = schema.modeOptions?.map((option) => option.value) ?? [];
      params.mode = allowedModes.includes(rawMode) ? rawMode : schema.defaultMode;
    }
    if (schema.defaultShape != null) {
      const rawShape = typeof value.shape === "string" ? value.shape : schema.defaultShape;
      const allowedShapes = schema.shapeOptions?.map((option) => option.value) ?? [];
      params.shape = allowedShapes.includes(rawShape) ? rawShape : schema.defaultShape;
    }
    if (schema.defaultCount != null) {
      params.count = typeof value.count === "number"
        ? Math.max(schema.countMin!, Math.min(schema.countMax!, Math.round(value.count)))
        : schema.defaultCount;
    }
    if (schema.defaultWidth != null) {
      params.width = typeof value.width === "number"
        ? Math.max(schema.widthMin!, Math.min(schema.widthMax!, normalizeLegacyEffectDefault(pageMode, scope, name, "width", value.width)))
        : schema.defaultWidth;
    }
    if (schema.defaultSpacing != null) {
      params.spacing = typeof value.spacing === "number"
        ? Math.max(schema.spacingMin!, Math.min(schema.spacingMax!, normalizeLegacyEffectDefault(pageMode, scope, name, "spacing", value.spacing)))
        : schema.defaultSpacing;
    }
    if (schema.defaultSize != null) {
      params.size = typeof value.size === "number"
        ? Math.max(schema.sizeMin!, Math.min(schema.sizeMax!, normalizeLegacyEffectDefault(pageMode, scope, name, "size", value.size)))
        : schema.defaultSize;
    }
    if (schema.defaultColor != null) {
      params.color = typeof value.color === "string" ? value.color : schema.defaultColor;
    }
    result[name] = params;
  }
  return result;
}

// ── Extraction ──────────────────────────────────────────────────────────────

export function extractRenderOptions(settings: Partial<RenderOptions>): RenderOptions {
  const pageMode = settings.pageMode === "long" ? "long" : "card";
  const modeDefaults = getModeAwareRenderDefaults(pageMode);
  const options: RenderOptions = {
    ...modeDefaults,
    coverEffects: { ...modeDefaults.coverEffects },
    bodyEffects: { ...modeDefaults.bodyEffects },
  };
  const optionsMutable = options as Record<string, unknown>;
  for (const key of RENDER_KEYS) {
    const value = settings[key];
    if (value !== undefined) {
      if (key === "coverEffects" || key === "bodyEffects") {
        const target = options[key];
        const src = value;
        for (const [name, params] of Object.entries(src)) {
          if (name in target) {
            target[name] = { ...params };
          }
        }
      } else {
        optionsMutable[key] = value;
      }
    }
  }
  return options;
}

export function buildCoverConfig(options: RenderOptions): CoverConfig {
  const pageMode = (options.pageMode ?? "card") as "card" | "long";
  return {
    typography: {
      fontFamily: options.coverFontFamily || options.fontFamily,
      color: options.coverFontColor || "",
      opacity: options.coverFontOpacity ?? 100,
      scale: options.coverFontScale ?? 100,
      weight: options.coverFontWeight ?? 800,
      letterSpacing: options.coverLetterSpacing ?? 5,
      lineHeight: options.coverLineHeight ?? 1.3,
      align: (options.coverTextAlign ?? "left") as CoverTypographyConfig["align"],
    },
    position: {
      offsetX: options.coverOffsetX ?? 0,
      offsetY: options.coverOffsetY ?? 0,
      paddingX: options.coverPagePaddingX ?? getDefaultCoverPaddingX(pageMode),
    },
    stroke: {
      style: (options.coverStrokeStyle || "stroke") as CoverStrokeConfig["style"],
      opacity: options.coverStrokeOpacity ?? 90,
      inner: {
        widthPercent: options.coverStrokePercent ?? 9,
        color: options.coverStrokeColor || "",
      },
      outer: {
        widthPercent: options.coverDoubleStrokePercent ?? 5,
        color: options.coverDoubleStrokeColor || "",
      },
    },
    glow: {
      enabled: options.coverGlow === true,
      size: options.coverGlowSize ?? 30,
      color: options.coverGlowColor || "",
    },
    shadow: {
      enabled: options.coverShadow !== false,
      blur: options.coverShadowBlur ?? 21,
      offsetX: options.coverShadowOffsetX ?? 3,
      offsetY: options.coverShadowOffsetY ?? 5,
      color: options.coverShadowColor || "rgba(0,0,0,0.6)",
    },
    banner: {
      enabled: options.coverBanner === true,
      color: options.coverBannerColor || "rgba(0,0,0,0.5)",
      skew: options.coverBannerSkew ?? 6,
      paddingPercent: options.coverBannerPaddingPercent ?? 40,
    },
  };
}

export function toSemanticNoteConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const cover: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) continue;
    if (key === "coverEffects") {
      cover.effects = value;
      continue;
    }
    if (key === "bodyEffects") {
      result.body = { ...(result.body as Record<string, unknown> | undefined), effects: value };
      continue;
    }

    const noteKey = (INTERNAL_TO_NOTE_KEY as Record<string, string>)[key] || key;
    const path = COVER_SEMANTIC_FIELD_PATHS[key];
    if (path) {
      setNestedValue(cover, path as readonly string[], value);
      continue;
    }

    result[noteKey] = value;
  }

  if (Object.keys(cover).length > 0) {
    result.cover = cover;
  }

  return result;
}

export function toNoteConfigKeys(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    const noteKey = (INTERNAL_TO_NOTE_KEY as Record<string, string>)[key] || key;
    // Convert internal values to display values for note storage
    const schema = getFieldSchema(key);
    if (schema?.type === "number" && schema.toDisplay && typeof value === "number") {
      result[noteKey] = parseFloat(schema.toDisplay(value));
    } else {
      result[noteKey] = value;
    }
  }
  return result;
}
