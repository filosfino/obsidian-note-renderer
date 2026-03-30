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
  activeTheme:       { type: "string",  default: "cream", enum: BUILTIN_THEMES,
                       description: "配色主题。浅色：paper / cream / latte / sage / mist / rose；深色：graphite / ink-gold / amber。也可填自定义主题文件名（不含 .css）" } as StringField,
  fontSize:          { type: "number",  default: 42, min: 24, max: 72, step: 2, unit: "px",
                       description: "正文字号" } as NumericField,
  fontFamily:        { type: "string",  default: '"PingFang SC", "Noto Sans SC", sans-serif',
                       description: "正文字体族，CSS font-family 格式" } as StringField,
  pageMode:          { type: "string",  default: "long", enum: ["long", "card"] as const,
                       description: "页面比例：long = 3:5，card = 3:4" } as StringField,

  // ── Cover text ──
  coverFontFamily:   { type: "string",  default: '"Yuanti SC", "PingFang SC", sans-serif',
                       description: "封面标题字体族" } as StringField,
  coverFontColor:    { type: "string",  default: "",
                       description: "封面标题颜色，留空则跟随主题；支持任意 CSS 颜色值" } as StringField,
  coverFontScale:    { type: "number",  default: 100, min: 50, max: 300, step: 10, unit: "%",
                       description: "封面标题字号缩放比例" } as NumericField,
  coverFontWeight:   { type: "number",  default: 800, min: 100, max: 900, step: 100,
                       description: "封面标题字重（100 最细，900 最粗）" } as NumericField,
  coverLetterSpacing:{ type: "number",  default: 5, min: -5, max: 30,
                       description: "封面标题字间距（px）" } as NumericField,
  coverLineHeight:   { type: "number",  default: 1.3, min: 0.8, max: 2.5, step: 0.1,
                       description: "封面标题行高倍数",
                     } as NumericField,
  coverTextAlign:    { type: "string",  default: "left", enum: ["left", "center", "right"] as const,
                       description: "封面标题对齐方式" } as StringField,
  coverOffsetX:      { type: "number",  default: 0, min: -50, max: 50, unit: "%",
                       description: "封面标题水平偏移" } as NumericField,
  coverOffsetY:      { type: "number",  default: 0, min: -50, max: 50, unit: "%",
                       description: "封面标题垂直偏移" } as NumericField,

  // ── Cover text effects ──
  coverStrokeStyle:  { type: "string",  default: "stroke", enum: ["none", "stroke", "double", "hollow"] as const,
                       description: "封面标题描边样式。stroke = 单层描边，double = 内外双描边，hollow = 透明填充仅保留外轮廓" } as StringField,
  coverStrokePercent:{ type: "number",  default: 9, min: 0, max: 100, step: 0.5,
                       description: "主描边粗细（相对于字号的百分比）。double 模式下表示内描边，hollow 模式下表示镂空轮廓粗细" } as NumericField,
  coverStrokeOpacity:{ type: "number",  default: 90, min: 0, max: 100,
                       description: "描边不透明度。作用于描边层，不改变文字填充本身透明度；hollow 模式下通常隐藏" } as NumericField,
  coverStrokeColor:  { type: "string",  default: "",
                       description: "描边颜色，留空则跟随主题标题色；支持任意 CSS 颜色值" } as StringField,
  coverDoubleStrokePercent:{ type: "number",  default: 5, min: 0, max: 120, step: 0.5,
                       description: "第二层描边粗细（相对于字号的百分比，仅 double 生效）。表示外描边" } as NumericField,
  coverDoubleStrokeColor:{ type: "string",  default: "",
                       description: "第二层描边颜色，留空则跟随 theme 派生的外描边默认色；支持任意 CSS 颜色值" } as StringField,
  coverGlow:         { type: "boolean", default: false,
                       description: "封面标题是否显示发光。可与描边、投影、色带同时开启" } as BooleanField,
  coverGlowSize:     { type: "number",  default: 60, min: 0, max: 80, step: 10,
                       description: "发光效果半径" } as NumericField,
  coverGlowColor:    { type: "string",  default: "",
                       description: "发光颜色，留空则跟随文字颜色；支持任意 CSS 颜色值" } as StringField,
  coverShadow:       { type: "boolean", default: true,
                       description: "封面标题是否显示投影" } as BooleanField,
  coverShadowBlur:   { type: "number",  default: 16, min: 0, max: 200,
                       description: "标题投影模糊半径" } as NumericField,
  coverShadowOffsetX:{ type: "number",  default: 0, min: -100, max: 100,
                       description: "标题投影水平偏移" } as NumericField,
  coverShadowOffsetY:{ type: "number",  default: 4, min: -100, max: 100,
                       description: "标题投影垂直偏移" } as NumericField,
  coverShadowColor:  { type: "string",  default: "rgba(0,0,0,0.6)",
                       description: "标题投影颜色，支持任意 CSS 颜色值含 rgba" } as StringField,
  coverBanner:       { type: "boolean", default: false,
                       description: "封面是否显示斜条 banner 装饰" } as BooleanField,
  coverBannerColor:  { type: "string",  default: "rgba(0,0,0,0.5)",
                       description: "banner 颜色，支持 CSS 颜色值含 rgba" } as StringField,
  coverBannerSkew:   { type: "number",  default: 6, min: 0, max: 20,
                       description: "banner 倾斜角度（度）" } as NumericField,
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
  count?: number;
}

export interface EffectSchema {
  label: string;
  description?: string;
  defaultEnabled: boolean;
  defaultOpacity: number;
  min: number;
  max: number;
  /** Count parameter — only for effects with discrete elements. */
  defaultCount?: number;
  countMin?: number;
  countMax?: number;
}

/** Effect definitions — single source of truth for defaults + UI constraints. 仅作用于封面页。 */
export const EFFECT_SCHEMAS: Record<string, EffectSchema> = {
  overlay:   { label: "遮罩",   description: "封面特效。纯色半透明遮罩，压暗背景突出文字",
               defaultEnabled: true,  defaultOpacity: 55, min: 0,  max: 100 },
  vignette:  { label: "暗角",   description: "封面特效。四角渐暗，模拟镜头暗角",
               defaultEnabled: false, defaultOpacity: 50, min: 0,  max: 100 },
  grain:     { label: "噪点",   description: "封面特效。胶片颗粒质感",
               defaultEnabled: false, defaultOpacity: 8,  min: 1,  max: 50 },
  aurora:    { label: "极光",   description: "封面特效。彩色光带，count 控制光带数量",
               defaultEnabled: false, defaultOpacity: 30, min: 5,  max: 80, defaultCount: 3,  countMin: 2, countMax: 6 },
  bokeh:     { label: "散景",   description: "封面特效。虚化光斑，count 控制光斑数量",
               defaultEnabled: false, defaultOpacity: 12, min: 1,  max: 50, defaultCount: 16, countMin: 4, countMax: 40 },
  grid:      { label: "网格",   description: "封面特效。细线网格纹理",
               defaultEnabled: false, defaultOpacity: 6,  min: 1,  max: 30 },
  lightLeak: { label: "漏光",   description: "封面特效。模拟胶片漏光，count 控制漏光区域数",
               defaultEnabled: false, defaultOpacity: 25, min: 5,  max: 80, defaultCount: 2,  countMin: 1, countMax: 5 },
  scanlines: { label: "扫描线", description: "封面特效。水平扫描线，CRT 显示器风格",
               defaultEnabled: false, defaultOpacity: 8,  min: 1,  max: 30 },
  network:   { label: "网络",   description: "封面特效。随机连线节点图案，count 控制节点数",
               defaultEnabled: false, defaultOpacity: 15, min: 5,  max: 50, defaultCount: 10, countMin: 4, countMax: 20 },
};

export const EFFECT_NAMES: string[] = Object.keys(EFFECT_SCHEMAS);

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
      ...(s.defaultCount != null ? { count: s.defaultCount } : {}),
    }])
  ) as Record<string, EffectParams>,
} as {
  // Explicit type for TS inference (Object.fromEntries loses key types)
  [K in keyof typeof FIELD_SCHEMAS]: (typeof FIELD_SCHEMAS)[K]["default"];
} & {
  coverEffects: Record<string, EffectParams>;
};

// ── Derived types ────────────────────────────────────────────────────────────

export type RenderOptions = typeof RENDER_DEFAULTS;
export type RenderKey = keyof RenderOptions;
export const RENDER_KEYS: RenderKey[] = Object.keys(RENDER_DEFAULTS) as RenderKey[];

export interface CoverTypographyConfig {
  fontFamily: string;
  color: string;
  scale: number;
  weight: number;
  letterSpacing: number;
  lineHeight: number;
  align: "left" | "center" | "right";
}

export interface CoverPositionConfig {
  offsetX: number;
  offsetY: number;
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
  key: string;
  noteKey: string;
  description: string;
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
      fontFamily: { key: "coverFontFamily", noteKey: "coverFontFamily", description: "封面标题字体族", examples: ['"Yuanti SC", "PingFang SC", sans-serif'] },
      color: { key: "coverFontColor", noteKey: "coverFontColor", description: "封面标题填充色；留空时跟随主题标题色", followsThemeWhenEmpty: true, relatedFields: ["coverGlowColor", "coverStrokeColor"], examples: ["#111111", "#ffffff", ""] },
      scale: { key: "coverFontScale", noteKey: "coverFontScale", description: "封面标题字号缩放比例", examples: ["100", "180", "240"] },
      weight: { key: "coverFontWeight", noteKey: "coverFontWeight", description: "封面标题字重", examples: ["700", "800", "900"] },
      letterSpacing: { key: "coverLetterSpacing", noteKey: "coverLetterSpacing", description: "封面标题字间距", examples: ["0", "5", "12"] },
      lineHeight: { key: "coverLineHeight", noteKey: "coverLineHeight", description: "封面标题行高", examples: ["1.1", "1.3", "1.6"] },
      align: { key: "coverTextAlign", noteKey: "coverTextAlign", description: "封面标题对齐方式", examples: ["left", "center", "right"] },
    },
  },
  position: {
    label: "位置",
    description: "封面标题相对封面中心的偏移。",
    composition: "只影响封面标题块的位置，不改变页面整体布局。",
    fields: {
      offsetX: { key: "coverOffsetX", noteKey: "coverOffsetX", description: "水平偏移百分比", examples: ["-10", "0", "12"] },
      offsetY: { key: "coverOffsetY", noteKey: "coverOffsetY", description: "垂直偏移百分比", examples: ["-8", "0", "10"] },
    },
  },
  stroke: {
    label: "描边",
    description: "封面标题描边系统，支持单描边、双描边和镂空。",
    composition: "double 表示内外双描边；hollow 表示透明填充，仅保留轮廓线。",
    fields: {
      style: { key: "coverStrokeStyle", noteKey: "coverStrokeStyle", description: "描边模式：none / stroke / double / hollow", relatedFields: ["coverStrokePercent", "coverDoubleStrokePercent"], examples: ["stroke", "double", "hollow"] },
      opacity: { key: "coverStrokeOpacity", noteKey: "coverStrokeOpacity", description: "描边透明度；主要作用于描边层，不影响文字填充", appliesWhen: "coverStrokeStyle != none && coverStrokeStyle != hollow", examples: ["60", "90", "100"] },
      innerWidth: { key: "coverStrokePercent", noteKey: "coverStrokePercent", description: "内描边粗度，相对字号的百分比", appliesWhen: "coverStrokeStyle in [stroke, double, hollow]", relatedFields: ["coverStrokeStyle", "coverStrokeColor"], examples: ["1", "5", "9"] },
      innerColor: { key: "coverStrokeColor", noteKey: "coverStrokeColor", description: "内描边颜色；留空时跟随当前 theme 派生色", appliesWhen: "coverStrokeStyle in [stroke, double, hollow]", followsThemeWhenEmpty: true, relatedFields: ["coverFontColor", "coverDoubleStrokeColor"], examples: ["#ffffff", "#111111", ""] },
      outerWidth: { key: "coverDoubleStrokePercent", noteKey: "coverDoubleStrokePercent", description: "外描边粗度，仅 double 模式生效", appliesWhen: "coverStrokeStyle == double", relatedFields: ["coverStrokeStyle", "coverDoubleStrokeColor"], examples: ["3", "5", "10"] },
      outerColor: { key: "coverDoubleStrokeColor", noteKey: "coverDoubleStrokeColor", description: "外描边颜色，仅 double 模式生效；留空时跟随当前 theme 派生色", appliesWhen: "coverStrokeStyle == double", followsThemeWhenEmpty: true, relatedFields: ["coverStrokeColor"], examples: ["#2b1a1a", "#000000", ""] },
    },
  },
  glow: {
    label: "发光",
    description: "封面标题发光效果，可与描边、投影叠加。",
    composition: "独立开关，不与描边或投影互斥。",
    fields: {
      enabled: { key: "coverGlow", noteKey: "coverGlow", description: "是否启用发光", relatedFields: ["coverGlowSize", "coverGlowColor"], examples: ["true", "false"] },
      size: { key: "coverGlowSize", noteKey: "coverGlowSize", description: "发光强度", appliesWhen: "coverGlow == true", examples: ["20", "40", "60"] },
      color: { key: "coverGlowColor", noteKey: "coverGlowColor", description: "发光颜色；留空时跟随文字填充色", appliesWhen: "coverGlow == true", followsThemeWhenEmpty: true, relatedFields: ["coverFontColor"], examples: ["#ffcc66", "#ffffff", ""] },
    },
  },
  shadow: {
    label: "投影",
    description: "封面标题投影效果，可与描边、发光叠加。",
    composition: "独立开关，不与描边或发光互斥。",
    fields: {
      enabled: { key: "coverShadow", noteKey: "coverShadow", description: "是否启用投影", relatedFields: ["coverShadowBlur", "coverShadowColor"], examples: ["true", "false"] },
      blur: { key: "coverShadowBlur", noteKey: "coverShadowBlur", description: "投影模糊半径", appliesWhen: "coverShadow == true", examples: ["8", "16", "32"] },
      offsetX: { key: "coverShadowOffsetX", noteKey: "coverShadowOffsetX", description: "投影水平偏移", appliesWhen: "coverShadow == true", examples: ["0", "2", "-2"] },
      offsetY: { key: "coverShadowOffsetY", noteKey: "coverShadowOffsetY", description: "投影垂直偏移", appliesWhen: "coverShadow == true", examples: ["2", "4", "8"] },
      color: { key: "coverShadowColor", noteKey: "coverShadowColor", description: "投影颜色", appliesWhen: "coverShadow == true", relatedFields: ["coverShadowBlur"], examples: ["rgba(0,0,0,0.6)", "#000000"] },
    },
  },
  banner: {
    label: "色带",
    description: "封面标题背景色带效果。",
    composition: "在标题文字背后生成一条斜切背景带。",
    fields: {
      enabled: { key: "coverBanner", noteKey: "coverBanner", description: "是否启用色带", relatedFields: ["coverBannerColor", "coverBannerSkew"], examples: ["true", "false"] },
      color: { key: "coverBannerColor", noteKey: "coverBannerColor", description: "色带颜色", appliesWhen: "coverBanner == true", examples: ["rgba(0,0,0,0.5)", "#222222"] },
      skew: { key: "coverBannerSkew", noteKey: "coverBannerSkew", description: "色带切角/倾斜度", appliesWhen: "coverBanner == true", examples: ["4", "6", "10"] },
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
  return evaluateSemanticCondition(meta.appliesWhen, values as Record<string, unknown>);
}

// ── Key mapping ──────────────────────────────────────────────────────────────

export const NOTE_KEY_ALIASES: Record<string, RenderKey> = {
  theme: "activeTheme",
};

export const INTERNAL_TO_NOTE_KEY: Partial<Record<RenderKey, string>> = {
  activeTheme: "theme",
};

export function withRendererConfigVersion(config: Record<string, unknown>): Record<string, unknown> {
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
 * - Validates coverEffects as nested object
 * - Drops unknown keys
 */
export function validateNoteConfig(raw: Record<string, unknown>): Partial<RenderOptions> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    const canonicalKey = (NOTE_KEY_ALIASES[key] || key) as string;
    if (!(canonicalKey in RENDER_DEFAULTS)) continue;

    if (canonicalKey === "coverEffects") {
      if (typeof value === "object" && !Array.isArray(value)) {
        const validated = validateCoverEffects(value as Record<string, unknown>);
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
      result[canonicalKey] = clampToSchema(internal, schema);
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

function validateCoverEffects(raw: Record<string, unknown>): Record<string, EffectParams> {
  const result: Record<string, EffectParams> = {};
  for (const [name, value] of Object.entries(raw)) {
    const schema = EFFECT_SCHEMAS[name];
    if (!schema) continue;
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const v = value as Record<string, unknown>;
    const opacity = typeof v.opacity === "number"
      ? Math.max(schema.min, Math.min(schema.max, v.opacity))
      : schema.defaultOpacity;
    const params: EffectParams = {
      enabled: typeof v.enabled === "boolean" ? v.enabled : schema.defaultEnabled,
      opacity,
    };
    if (schema.defaultCount != null) {
      params.count = typeof v.count === "number"
        ? Math.max(schema.countMin!, Math.min(schema.countMax!, Math.round(v.count)))
        : schema.defaultCount;
    }
    result[name] = params;
  }
  return result;
}

// ── Extraction ──────────────────────────────────────────────────────────────

export function extractRenderOptions(settings: Record<string, unknown>): RenderOptions {
  const options = { ...RENDER_DEFAULTS, coverEffects: { ...RENDER_DEFAULTS.coverEffects } };
  for (const key of RENDER_KEYS) {
    if (key in settings && settings[key] !== undefined) {
      if (key === "coverEffects") {
        const src = settings[key] as Record<string, EffectParams>;
        for (const [name, params] of Object.entries(src)) {
          if (name in options.coverEffects) {
            options.coverEffects[name] = { ...params };
          }
        }
      } else {
        (options as Record<string, unknown>)[key] = settings[key];
      }
    }
  }
  return options;
}

export function buildCoverConfig(options: RenderOptions): CoverConfig {
  return {
    typography: {
      fontFamily: options.coverFontFamily || options.fontFamily,
      color: options.coverFontColor || "",
      scale: options.coverFontScale ?? 100,
      weight: options.coverFontWeight ?? 800,
      letterSpacing: options.coverLetterSpacing ?? 5,
      lineHeight: options.coverLineHeight ?? 1.3,
      align: (options.coverTextAlign ?? "left") as CoverTypographyConfig["align"],
    },
    position: {
      offsetX: options.coverOffsetX ?? 0,
      offsetY: options.coverOffsetY ?? 0,
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
      size: options.coverGlowSize ?? 60,
      color: options.coverGlowColor || "",
    },
    shadow: {
      enabled: options.coverShadow !== false,
      blur: options.coverShadowBlur ?? 16,
      offsetX: options.coverShadowOffsetX ?? 0,
      offsetY: options.coverShadowOffsetY ?? 4,
      color: options.coverShadowColor || "rgba(0,0,0,0.6)",
    },
    banner: {
      enabled: options.coverBanner === true,
      color: options.coverBannerColor || "rgba(0,0,0,0.5)",
      skew: options.coverBannerSkew ?? 6,
    },
  };
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
