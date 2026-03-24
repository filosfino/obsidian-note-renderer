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
  /** Transform internal value → display string. Default: String() */
  toDisplay?: (v: number) => string;
  /** Transform display string → internal value. Default: parseFloat() */
  fromDisplay?: (v: string) => number;
}

interface StringField {
  type: "string";
  default: string;
  enum?: readonly string[];  // constrained to these values
}

interface BooleanField {
  type: "boolean";
  default: boolean;
}

export type FieldSchema = NumericField | StringField | BooleanField;

// ── Field schema definitions ────────────────────────────────────────────────

export const FIELD_SCHEMAS = {
  // ── Basic ──
  activeTheme:       { type: "string",  default: "cream" } as StringField,
  fontSize:          { type: "number",  default: 42, min: 24, max: 72, step: 2, unit: "px" } as NumericField,
  fontFamily:        { type: "string",  default: '"PingFang SC", "Noto Sans SC", sans-serif' } as StringField,
  pageMode:          { type: "string",  default: "long", enum: ["long", "card"] as const } as StringField,

  // ── Cover text ──
  coverFontFamily:   { type: "string",  default: '"Yuanti SC", "PingFang SC", sans-serif' } as StringField,
  coverFontColor:    { type: "string",  default: "" } as StringField,
  coverFontScale:    { type: "number",  default: 100, min: 50, max: 300, step: 10, unit: "%" } as NumericField,
  coverFontWeight:   { type: "number",  default: 800, min: 100, max: 900, step: 100 } as NumericField,
  coverLetterSpacing:{ type: "number",  default: 5, min: -5, max: 30 } as NumericField,
  coverLineHeight:   { type: "number",  default: 13, min: 8, max: 25, step: 1,
                       toDisplay: (v: number) => (v / 10).toFixed(1),
                       fromDisplay: (v: string) => Math.round(parseFloat(v) * 10),
                     } as NumericField,
  coverTextAlign:    { type: "string",  default: "left", enum: ["left", "center", "right"] as const } as StringField,
  coverOffsetX:      { type: "number",  default: 0, min: -50, max: 50, unit: "%" } as NumericField,
  coverOffsetY:      { type: "number",  default: 0, min: -50, max: 50, unit: "%" } as NumericField,

  // ── Cover text effects ──
  coverStrokeStyle:  { type: "string",  default: "stroke", enum: ["none", "stroke", "double", "shadow", "glow"] as const } as StringField,
  coverStrokePercent:{ type: "number",  default: 20, min: 0, max: 100 } as NumericField,
  coverStrokeOpacity:{ type: "number",  default: 90, min: 0, max: 100 } as NumericField,
  coverGlowSize:     { type: "number",  default: 60, min: 0, max: 200 } as NumericField,
  coverShadow:       { type: "boolean", default: true } as BooleanField,
  coverShadowBlur:   { type: "number",  default: 16, min: 0, max: 200 } as NumericField,
  coverShadowOffsetX:{ type: "number",  default: 0, min: -100, max: 100 } as NumericField,
  coverShadowOffsetY:{ type: "number",  default: 4, min: -100, max: 100 } as NumericField,
  coverBanner:       { type: "boolean", default: false } as BooleanField,
  coverBannerColor:  { type: "string",  default: "rgba(0,0,0,0.5)" } as StringField,
  coverBannerSkew:   { type: "number",  default: 6, min: 0, max: 20 } as NumericField,
} as const satisfies Record<string, FieldSchema>;

/** Lookup field schema by key. Returns undefined for unknown keys. */
export function getFieldSchema(key: string): FieldSchema | undefined {
  return (FIELD_SCHEMAS as Record<string, FieldSchema>)[key];
}

// ── Effect schema ───────────────────────────────────────────────────────────

export interface EffectParams {
  enabled: boolean;
  opacity: number;
}

export interface EffectSchema {
  label: string;
  defaultEnabled: boolean;
  defaultOpacity: number;
  min: number;
  max: number;
}

/** Effect definitions — single source of truth for defaults + UI constraints. */
export const EFFECT_SCHEMAS: Record<string, EffectSchema> = {
  overlay:   { label: "遮罩",   defaultEnabled: true,  defaultOpacity: 55, min: 0,  max: 100 },
  vignette:  { label: "暗角",   defaultEnabled: false, defaultOpacity: 50, min: 0,  max: 100 },
  grain:     { label: "噪点",   defaultEnabled: false, defaultOpacity: 8,  min: 1,  max: 50 },
  aurora:    { label: "极光",   defaultEnabled: false, defaultOpacity: 30, min: 5,  max: 80 },
  bokeh:     { label: "散景",   defaultEnabled: false, defaultOpacity: 12, min: 1,  max: 50 },
  grid:      { label: "网格",   defaultEnabled: false, defaultOpacity: 6,  min: 1,  max: 30 },
  lightLeak: { label: "漏光",   defaultEnabled: false, defaultOpacity: 25, min: 5,  max: 80 },
  scanlines: { label: "扫描线", defaultEnabled: false, defaultOpacity: 8,  min: 1,  max: 30 },
  network:   { label: "网络",   defaultEnabled: false, defaultOpacity: 15, min: 5,  max: 50 },
};

export const EFFECT_NAMES: string[] = Object.keys(EFFECT_SCHEMAS);

// ── Derived: RENDER_DEFAULTS ────────────────────────────────────────────────

/** All render parameters with their default values — derived from FIELD_SCHEMAS + EFFECT_SCHEMAS. */
export const RENDER_DEFAULTS = {
  ...Object.fromEntries(
    Object.entries(FIELD_SCHEMAS).map(([key, schema]) => [key, schema.default])
  ),
  coverEffects: Object.fromEntries(
    Object.entries(EFFECT_SCHEMAS).map(([name, s]) => [name, { enabled: s.defaultEnabled, opacity: s.defaultOpacity }])
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

// ── Key mapping ──────────────────────────────────────────────────────────────

export const NOTE_KEY_ALIASES: Record<string, RenderKey> = {
  theme: "activeTheme",
};

export const INTERNAL_TO_NOTE_KEY: Partial<Record<RenderKey, string>> = {
  activeTheme: "theme",
};

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

    // Clamp numeric values to schema range
    if (schema.type === "number" && typeof value === "number") {
      result[canonicalKey] = clampToSchema(value, schema);
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
    result[name] = {
      enabled: typeof v.enabled === "boolean" ? v.enabled : schema.defaultEnabled,
      opacity,
    };
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

export function toNoteConfigKeys(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    const noteKey = (INTERNAL_TO_NOTE_KEY as Record<string, string>)[key] || key;
    result[noteKey] = value;
  }
  return result;
}
