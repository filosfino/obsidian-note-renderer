/**
 * config-manager.ts — Unified config load / merge / write.
 *
 * All config operations go through here. Consumers should NOT
 * do inline merging, alias mapping, or markdown manipulation directly.
 */

import {
  RENDER_DEFAULTS,
  RENDER_KEYS,
  NOTE_KEY_ALIASES,
  INTERNAL_TO_NOTE_KEY,
  validateNoteConfig,
  extractRenderOptions,
  toNoteConfigKeys,
  type RenderOptions,
  type RenderKey,
  type EffectParams,
} from "./schema";

import { parseRendererConfig } from "./parser";

import type { NoteRendererSettings } from "./main";

// ── Read ────────────────────────────────────────────────────────────────────

/** Parse renderer_config from markdown. Returns null if absent or invalid. */
export function readNoteConfig(markdown: string): Partial<RenderOptions> | null {
  return parseRendererConfig(markdown) as Partial<RenderOptions> | null;
}

/**
 * Merge global settings with per-note overrides.
 * Note config values win; missing keys fall back to global.
 * Deep-merges coverEffects (per-effect override, not all-or-nothing).
 */
export function mergeConfigs(
  global: NoteRendererSettings,
  noteConfig: Partial<RenderOptions> | null,
): NoteRendererSettings {
  const merged: NoteRendererSettings = {
    ...global,
    coverEffects: deepCopyEffects(global.coverEffects),
  };
  if (!noteConfig) return merged;

  for (const [key, value] of Object.entries(noteConfig)) {
    if (!(key in merged) || value === undefined || value === null) continue;

    if (key === "coverEffects" && typeof value === "object") {
      // Deep merge: note overrides individual effects, rest kept from global
      for (const [name, params] of Object.entries(value as Record<string, EffectParams>)) {
        if (name in merged.coverEffects) {
          merged.coverEffects[name] = { ...merged.coverEffects[name], ...params };
        }
      }
    } else {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

function deepCopyEffects(effects: Record<string, EffectParams>): Record<string, EffectParams> {
  const copy: Record<string, EffectParams> = {};
  for (const [name, params] of Object.entries(effects)) {
    copy[name] = { ...params };
  }
  return copy;
}

// ── Write ───────────────────────────────────────────────────────────────────

/**
 * Update a single key in a note's renderer_config section.
 * Returns the modified markdown string.
 */
export function updateNoteConfigKey(
  markdown: string,
  key: string,
  value: unknown,
): string {
  const noteConfig = parseRendererConfig(markdown);
  if (!noteConfig) return markdown;

  const noteKey = (INTERNAL_TO_NOTE_KEY as Record<string, string>)[key] || key;
  noteConfig[noteKey] = value;

  const configSection = buildConfigSection(noteConfig);
  return insertConfigSection(removeConfigSection(markdown), configSection);
}

/**
 * Save full render options as renderer_config into markdown.
 * Returns the modified markdown string.
 */
export function saveFullNoteConfig(
  markdown: string,
  options: RenderOptions,
): string {
  const noteConfig = toNoteConfigKeys(options as unknown as Record<string, unknown>);
  const configSection = buildConfigSection(noteConfig);
  return insertConfigSection(markdown, configSection);
}

/** Remove renderer_config section from markdown. Returns modified markdown. */
export function removeNoteConfig(markdown: string): string {
  return removeConfigSection(markdown);
}

// ── Migration ───────────────────────────────────────────────────────────────

/**
 * Migrate legacy keys in raw settings loaded from disk.
 * - Resolves key aliases (theme → activeTheme)
 * - Converts flat effect keys (coverGrain/coverGrainOpacity) to nested coverEffects
 * Mutates and returns the same object.
 */
export function migrateSettings(raw: Record<string, unknown>): Record<string, unknown> {
  // Key aliases
  for (const [alias, canonical] of Object.entries(NOTE_KEY_ALIASES)) {
    if (alias in raw && !(canonical in raw)) {
      raw[canonical] = raw[alias];
    }
    delete raw[alias];
  }

  // Remove dead keys
  delete raw["coverStyle"];

  // Flat effect keys → nested coverEffects
  migrateFlatEffects(raw);

  return raw;
}

/** Convert legacy flat effect keys to nested coverEffects structure. */
function migrateFlatEffects(raw: Record<string, unknown>): void {
  const defaults = RENDER_DEFAULTS.coverEffects;
  // Map from flat key prefix to effect name
  const flatToEffect: Record<string, string> = {
    coverOverlay: "overlay",
    coverGrain: "grain",
    coverAurora: "aurora",
    coverBokeh: "bokeh",
    coverGrid: "grid",
    coverVignette: "vignette",
    coverLightLeak: "lightLeak",
    coverScanlines: "scanlines",
    coverNetwork: "network",
  };

  let hasFlat = false;
  for (const key of Object.keys(flatToEffect)) {
    if (key in raw || `${key}Opacity` in raw) {
      hasFlat = true;
      break;
    }
  }
  if (!hasFlat) return;

  // Build coverEffects from flat keys, falling back to defaults
  const effects: Record<string, EffectParams> = {};
  for (const [flatKey, effectName] of Object.entries(flatToEffect)) {
    const opKey = `${flatKey}Opacity`;
    effects[effectName] = {
      enabled: typeof raw[flatKey] === "boolean" ? raw[flatKey] as boolean : defaults[effectName].enabled,
      opacity: typeof raw[opKey] === "number" ? raw[opKey] as number : defaults[effectName].opacity,
    };
    delete raw[flatKey];
    delete raw[opKey];
  }

  // Only set if no coverEffects already present (don't overwrite new format)
  if (!raw.coverEffects) {
    raw.coverEffects = effects;
  }
}

// ── Re-exports (so consumers only import from config-manager) ───────────────

export { extractRenderOptions, RENDER_KEYS, RENDER_DEFAULTS };
export type { RenderOptions, RenderKey };

// ── Internal helpers ────────────────────────────────────────────────────────

function buildConfigSection(config: Record<string, unknown>): string {
  const json = JSON.stringify(config, null, 2);
  return `\n## renderer_config\n\n\`\`\`json\n${json}\n\`\`\`\n`;
}

/** Remove `## renderer_config` section (and its content) from markdown. */
function removeConfigSection(markdown: string): string {
  return markdown.replace(/\n## renderer_config\n[\s\S]*?(?=\n## |\n*$)/, "").trimEnd() + "\n";
}

/**
 * Insert renderer_config section into markdown.
 * Inserts before `## 正文描述` if present, otherwise appends at end.
 */
function insertConfigSection(markdown: string, configSection: string): string {
  const insertBefore = /(\n## 正文描述\n)/;
  if (insertBefore.test(markdown)) {
    return markdown.replace(insertBefore, `${configSection}$1`);
  }
  return markdown.trimEnd() + "\n" + configSection;
}
