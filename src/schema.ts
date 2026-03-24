/**
 * schema.ts — Config single source of truth.
 *
 * All render parameters are defined here. To add a new parameter:
 * 1. Add it to RENDER_DEFAULTS with its default value
 * 2. Done — types, preset keys, validation, and options passing all derive from this.
 */

import type { CoverStrokeStyle, CoverTextAlign, PageMode } from "./constants";

// ── Render defaults ──────────────────────────────────────────────────────────

/** All render parameters with their default values. */
export const RENDER_DEFAULTS = {
  activeTheme: "cream" as string,
  fontSize: 42,
  fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif' as string,
  coverFontFamily: '"Yuanti SC", "PingFang SC", sans-serif' as string,
  coverStrokePercent: 20,
  coverStrokeStyle: "stroke" as CoverStrokeStyle,
  coverStrokeOpacity: 90,
  coverGlowSize: 60,
  coverBanner: false,
  coverBannerColor: "rgba(0,0,0,0.5)" as string,
  coverBannerSkew: 6,
  coverFontColor: "" as string,
  coverFontScale: 100,
  coverFontWeight: 800,
  coverLetterSpacing: 5,
  coverLineHeight: 13,
  coverOffsetX: 0,
  coverOffsetY: 0,
  coverOverlay: true,
  coverOverlayOpacity: 55,
  coverGrain: false,
  coverGrainOpacity: 8,
  coverAurora: false,
  coverAuroraOpacity: 30,
  coverBokeh: false,
  coverBokehOpacity: 12,
  coverGrid: false,
  coverGridOpacity: 6,
  coverVignette: false,
  coverVignetteOpacity: 50,
  coverLightLeak: false,
  coverLightLeakOpacity: 25,
  coverScanlines: false,
  coverScanlinesOpacity: 8,
  coverNetwork: false,
  coverNetworkOpacity: 15,
  coverShadow: true,
  coverShadowBlur: 16,
  coverShadowOffsetX: 0,
  coverShadowOffsetY: 4,
  coverTextAlign: "left" as CoverTextAlign,
  pageMode: "long" as PageMode,
};

// ── Derived types ────────────────────────────────────────────────────────────

/** Render options type — automatically derived from RENDER_DEFAULTS. */
export type RenderOptions = typeof RENDER_DEFAULTS;

/** All render parameter keys. */
export type RenderKey = keyof RenderOptions;
export const RENDER_KEYS: RenderKey[] = Object.keys(RENDER_DEFAULTS) as RenderKey[];

// ── Key mapping ──────────────────────────────────────────────────────────────

/** Note config aliases → internal key names (for reading note configs). */
export const NOTE_KEY_ALIASES: Record<string, RenderKey> = {
  theme: "activeTheme",
  template: "activeTheme",
  activeTemplate: "activeTheme",
  font: "fontFamily",
  coverFont: "coverFontFamily",
  mode: "pageMode",
};

/** Internal key → note config key (for writing note configs). */
export const INTERNAL_TO_NOTE_KEY: Partial<Record<RenderKey, string>> = {
  activeTheme: "theme",
};

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate and normalize a raw note config object.
 * - Resolves key aliases (e.g. "theme" → "activeTheme")
 * - Drops unknown keys
 * - Drops values with wrong types
 * - Returns a clean object with canonical keys
 */
export function validateNoteConfig(raw: Record<string, unknown>): Partial<RenderOptions> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    const canonicalKey = (NOTE_KEY_ALIASES[key] || key) as string;
    if (!(canonicalKey in RENDER_DEFAULTS)) continue;
    const defaultVal = (RENDER_DEFAULTS as Record<string, unknown>)[canonicalKey];
    if (typeof value !== typeof defaultVal) continue;
    result[canonicalKey] = value;
  }
  return result as Partial<RenderOptions>;
}

/**
 * Extract render options from a full settings object.
 * Only copies keys defined in RENDER_DEFAULTS.
 */
export function extractRenderOptions(settings: Record<string, unknown>): RenderOptions {
  const options = { ...RENDER_DEFAULTS };
  for (const key of RENDER_KEYS) {
    if (key in settings && settings[key] !== undefined) {
      (options as Record<string, unknown>)[key] = settings[key];
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
