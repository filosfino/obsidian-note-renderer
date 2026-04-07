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
  clamp?: boolean;     // default true; false means UI should not hard-clamp the value
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
  if (key === "coverShadowBlur") return 6;
  if (key === "coverShadowOffsetX") return 6;
  if (key === "coverShadowOffsetY") return 6;
  return cardValue;
}

function normalizeLegacyNumericDefault(key: string, value: number, pageMode: "card" | "long"): number {
  if (pageMode === "long") {
    if (key === "coverGlowSize" && value === 60) return 72;
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
  fontSize:          { type: "number",  default: 28, min: 20, max: 30, step: 1, unit: "px",
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
  coverOffsetX:      { type: "number",  default: 0, min: -50, max: 50, clamp: false, unit: "%",
                       description: "封面标题水平偏移" } as NumericField,
  coverOffsetY:      { type: "number",  default: -5, min: -50, max: 50, clamp: false, unit: "%",
                       description: "封面标题垂直偏移" } as NumericField,
  coverPagePaddingX: { type: "number",  default: getDefaultCoverPaddingX("card"), min: 0, max: 180, step: 2, unit: "px",
                       description: "封面文字左右边距；0 表示铺满整页宽度" } as NumericField,

  // ── Cover text effects ──
  coverStrokeStyle:  { type: "string",  default: "none", enum: ["none", "stroke", "double", "hollow"] as const,
                       description: "封面标题描边样式。stroke = 圆润单描边，double = 内外双描边，hollow = 透明填充仅保留外轮廓" } as StringField,
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
  coverShadowBlur:   { type: "number",  default: 6, min: 0, max: 200,
                       description: "标题投影模糊半径" } as NumericField,
  coverShadowOffsetX:{ type: "number",  default: 6, min: -100, max: 100,
                       description: "标题投影水平偏移" } as NumericField,
  coverShadowOffsetY:{ type: "number",  default: 6, min: -100, max: 100,
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

export interface SemanticFieldMeta {
  description: string;
  appliesWhen?: string;
  followsThemeWhenEmpty?: boolean;
  relatedFields?: readonly string[];
}

export interface SemanticGroupMeta {
  fields: Record<string, SemanticFieldMeta>;
}

export const COVER_SEMANTIC_SCHEMA = {
  typography: {
    fields: {
      fontFamily: { description: "封面标题字体族" },
      color: { description: "封面标题填充色；留空时跟随主题标题色", followsThemeWhenEmpty: true, relatedFields: ["coverGlowColor", "coverStrokeColor"] },
      opacity: { description: "封面标题整体透明度" },
      scale: { description: "封面标题字号缩放比例" },
      weight: { description: "封面标题字重" },
      letterSpacing: { description: "封面标题字间距" },
      lineHeight: { description: "封面标题行高" },
      align: { description: "封面标题对齐方式" },
    },
  },
  position: {
    fields: {
      offsetX: { description: "水平偏移百分比" },
      offsetY: { description: "垂直偏移百分比" },
      paddingX: { description: "封面页左右边距；0 表示铺满整页宽度，自动换行也会同步按可用宽度计算" },
    },
  },
  stroke: {
    fields: {
      style: { description: "描边模式：none / stroke / double / hollow", relatedFields: ["coverStrokePercent", "coverDoubleStrokePercent"] },
      opacity: { description: "描边透明度；主要作用于描边层，不影响文字填充", appliesWhen: "coverStrokeStyle != none && coverStrokeStyle != hollow" },
      innerWidth: { description: "描边粗度，相对字号的百分比", appliesWhen: "coverStrokeStyle in [stroke, double, hollow]", relatedFields: ["coverStrokeStyle", "coverStrokeColor"] },
      innerColor: { description: "描边颜色；留空时跟随当前 theme 派生色", followsThemeWhenEmpty: true, relatedFields: ["coverFontColor", "coverDoubleStrokeColor"], appliesWhen: "coverStrokeStyle in [stroke, double, hollow]" },
      outerWidth: { description: "外描边粗度，仅 double 模式生效", appliesWhen: "coverStrokeStyle == double", relatedFields: ["coverStrokeStyle", "coverDoubleStrokeColor"] },
      outerColor: { description: "外描边颜色，仅 double 模式生效；留空时跟随当前 theme 派生色", followsThemeWhenEmpty: true, relatedFields: ["coverStrokeColor"], appliesWhen: "coverStrokeStyle == double" },
    },
  },
  glow: {
    fields: {
      enabled: { description: "是否启用发光", relatedFields: ["coverGlowSize", "coverGlowColor"] },
      size: { description: "发光强度", appliesWhen: "coverGlow == true" },
      color: { description: "发光颜色；留空时跟随文字填充色", followsThemeWhenEmpty: true, relatedFields: ["coverFontColor"], appliesWhen: "coverGlow == true" },
    },
  },
  shadow: {
    fields: {
      enabled: { description: "是否启用投影", relatedFields: ["coverShadowBlur", "coverShadowColor"] },
      blur: { description: "投影模糊半径", appliesWhen: "coverShadow == true" },
      offsetX: { description: "投影水平偏移", appliesWhen: "coverShadow == true" },
      offsetY: { description: "投影垂直偏移", appliesWhen: "coverShadow == true" },
      color: { description: "投影颜色", appliesWhen: "coverShadow == true", relatedFields: ["coverShadowBlur"] },
    },
  },
  banner: {
    fields: {
      enabled: { description: "是否启用色带", relatedFields: ["coverBannerColor", "coverBannerSkew", "coverBannerPaddingPercent"] },
      color: { description: "色带颜色", appliesWhen: "coverBanner == true" },
      skew: { description: "色带切角/倾斜度", appliesWhen: "coverBanner == true" },
      paddingPercent: { description: "色带左右额外留白，按当前字号百分比计算，值越大越不容易被斜角压到文字", appliesWhen: "coverBanner == true" },
    },
  },
} as const satisfies Record<string, SemanticGroupMeta>;

type CoverSemanticGroupKey = keyof typeof COVER_SEMANTIC_SCHEMA;

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
      blur: options.coverShadowBlur ?? 6,
      offsetX: options.coverShadowOffsetX ?? 6,
      offsetY: options.coverShadowOffsetY ?? 6,
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
