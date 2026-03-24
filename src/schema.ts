/**
 * schema.ts — Config single source of truth.
 *
 * All render parameters are defined here. To add a new parameter:
 * 1. Add it to RENDER_DEFAULTS with its default value
 * 2. Done — types, preset keys, validation, and options passing all derive from this.
 *
 * To add a new cover effect:
 * 1. Add an entry to RENDER_DEFAULTS.coverEffects
 * 2. Add UI metadata to EFFECT_META
 * 3. Add rendering logic in renderer.ts applyEffects()
 */

import type { CoverStrokeStyle, CoverTextAlign, PageMode } from "./constants";

// ── Effect types ────────────────────────────────────────────────────────────

export interface EffectParams {
  enabled: boolean;
  opacity: number;
}

/** UI metadata for each effect — drives chip toggles and slider creation. */
export interface EffectMeta {
  label: string;
  min: number;
  max: number;
}

/** Registry of effect UI metadata. Order here = order in UI. */
export const EFFECT_META: Record<string, EffectMeta> = {
  overlay:   { label: "遮罩",   min: 0,  max: 100 },
  vignette:  { label: "暗角",   min: 0,  max: 100 },
  grain:     { label: "噪点",   min: 1,  max: 50 },
  aurora:    { label: "极光",   min: 5,  max: 80 },
  bokeh:     { label: "散景",   min: 1,  max: 50 },
  grid:      { label: "网格",   min: 1,  max: 30 },
  lightLeak: { label: "漏光",   min: 5,  max: 80 },
  scanlines: { label: "扫描线", min: 1,  max: 30 },
  network:   { label: "网络",   min: 5,  max: 50 },
};

// ── Render defaults ──────────────────────────────────────────────────────────

/** All render parameters with their default values. */
export const RENDER_DEFAULTS = {
  activeTheme: "cream" as string,
  fontSize: 42,
  fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif' as string,
  pageMode: "long" as PageMode,

  // Cover text
  coverFontFamily: '"Yuanti SC", "PingFang SC", sans-serif' as string,
  coverFontColor: "" as string,
  coverFontScale: 100,
  coverFontWeight: 800,
  coverLetterSpacing: 5,
  coverLineHeight: 13,
  coverTextAlign: "left" as CoverTextAlign,
  coverOffsetX: 0,
  coverOffsetY: 0,

  // Cover text effects (varied params, keep flat)
  coverStrokeStyle: "stroke" as CoverStrokeStyle,
  coverStrokePercent: 20,
  coverStrokeOpacity: 90,
  coverGlowSize: 60,
  coverShadow: true,
  coverShadowBlur: 16,
  coverShadowOffsetX: 0,
  coverShadowOffsetY: 4,
  coverBanner: false,
  coverBannerColor: "rgba(0,0,0,0.5)" as string,
  coverBannerSkew: 6,

  // Cover overlay effects (uniform shape, extensible)
  coverEffects: {
    overlay:   { enabled: true,  opacity: 55 },
    grain:     { enabled: false, opacity: 8 },
    aurora:    { enabled: false, opacity: 30 },
    bokeh:     { enabled: false, opacity: 12 },
    grid:      { enabled: false, opacity: 6 },
    vignette:  { enabled: false, opacity: 50 },
    lightLeak: { enabled: false, opacity: 25 },
    scanlines: { enabled: false, opacity: 8 },
    network:   { enabled: false, opacity: 15 },
  } as Record<string, EffectParams>,
};

// ── Derived types ────────────────────────────────────────────────────────────

/** Render options type — automatically derived from RENDER_DEFAULTS. */
export type RenderOptions = typeof RENDER_DEFAULTS;

/** All render parameter keys (top-level). */
export type RenderKey = keyof RenderOptions;
export const RENDER_KEYS: RenderKey[] = Object.keys(RENDER_DEFAULTS) as RenderKey[];

/** All known effect names. */
export type EffectName = keyof typeof RENDER_DEFAULTS.coverEffects;
export const EFFECT_NAMES: string[] = Object.keys(RENDER_DEFAULTS.coverEffects);

// ── Key mapping ──────────────────────────────────────────────────────────────

/**
 * Note config uses user-facing key names.
 * Internal settings use implementation key names.
 * Only `theme ↔ activeTheme` differs; all other keys are identical.
 */
export const NOTE_KEY_ALIASES: Record<string, RenderKey> = {
  theme: "activeTheme",
};

export const INTERNAL_TO_NOTE_KEY: Partial<Record<RenderKey, string>> = {
  activeTheme: "theme",
};

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate and normalize a raw note config object.
 * - Resolves key aliases (e.g. "theme" → "activeTheme")
 * - Validates coverEffects as nested object
 * - Drops unknown keys and wrong types
 * - Returns a clean object with canonical keys
 */
export function validateNoteConfig(raw: Record<string, unknown>): Partial<RenderOptions> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    const canonicalKey = (NOTE_KEY_ALIASES[key] || key) as string;
    if (!(canonicalKey in RENDER_DEFAULTS)) continue;

    if (canonicalKey === "coverEffects") {
      // Deep validate: only accept known effect names with correct shape
      if (typeof value === "object" && !Array.isArray(value)) {
        const validated = validateCoverEffects(value as Record<string, unknown>);
        if (Object.keys(validated).length > 0) {
          result[canonicalKey] = validated;
        }
      }
      continue;
    }

    const defaultVal = (RENDER_DEFAULTS as Record<string, unknown>)[canonicalKey];
    if (typeof value !== typeof defaultVal) continue;
    result[canonicalKey] = value;
  }
  return result as Partial<RenderOptions>;
}

function validateCoverEffects(raw: Record<string, unknown>): Record<string, EffectParams> {
  const defaults = RENDER_DEFAULTS.coverEffects;
  const result: Record<string, EffectParams> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!(name in defaults)) continue;
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const v = value as Record<string, unknown>;
    result[name] = {
      enabled: typeof v.enabled === "boolean" ? v.enabled : defaults[name].enabled,
      opacity: typeof v.opacity === "number" ? v.opacity : defaults[name].opacity,
    };
  }
  return result;
}

/**
 * Extract render options from a full settings object.
 * Only copies keys defined in RENDER_DEFAULTS. Deep-copies coverEffects.
 */
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

/**
 * Convert internal keys to note-facing keys for writing renderer_config JSON.
 */
export function toNoteConfigKeys(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    const noteKey = (INTERNAL_TO_NOTE_KEY as Record<string, string>)[key] || key;
    result[noteKey] = value;
  }
  return result;
}
