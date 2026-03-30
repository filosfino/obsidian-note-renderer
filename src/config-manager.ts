/**
 * config-manager.ts — Unified config load / merge / write.
 *
 * All config operations go through here. Consumers should NOT
 * do inline merging, alias mapping, or markdown manipulation directly.
 */

import {
  RENDER_DEFAULTS,
  RENDER_KEYS,
  withRendererConfigVersion,
  extractRenderOptions,
  buildCoverConfig,
  toNoteConfigKeys,
  toSemanticNoteConfig,
  getFieldSchema,
  type RenderOptions,
  type RenderKey,
  type EffectParams,
  type CoverConfig,
} from "./schema";

import { parseRendererConfig } from "./parser";
import { migrateRendererConfig } from "./config-migrations";

import type { NoteRendererSettings } from "./main";

export interface ResolvedRenderConfig {
  settings: NoteRendererSettings;
  options: RenderOptions;
  cover: CoverConfig;
}

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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- value is narrowed from unknown
      for (const [name, params] of Object.entries(value as Record<string, EffectParams>)) {
        if (name in merged.coverEffects) {
          merged.coverEffects[name] = { ...merged.coverEffects[name], ...params };
        }
      }
    } else {
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export function resolveMergedRenderConfig(
  global: NoteRendererSettings,
  noteConfig: Partial<RenderOptions> | null,
): ResolvedRenderConfig {
  const settings = mergeConfigs(global, noteConfig);
  const options = extractRenderOptions(settings as unknown as Record<string, unknown>);
  const cover = buildCoverConfig(options);
  return { settings, options, cover };
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

  // Convert internal value to display value for note storage
  const schema = getFieldSchema(key);
  if (schema?.type === "number" && schema.toDisplay && typeof value === "number") {
    noteConfig[key] = parseFloat(schema.toDisplay(value));
  } else {
    noteConfig[key] = value;
  }

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
  const configSection = buildConfigSection(options as unknown as Record<string, unknown>);
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
  return migrateRendererConfig(raw);
}

// ── Re-exports (so consumers only import from config-manager) ───────────────

export { extractRenderOptions, buildCoverConfig, RENDER_KEYS, RENDER_DEFAULTS };
export type { RenderOptions, RenderKey, CoverConfig };

// ── Internal helpers ────────────────────────────────────────────────────────

function buildConfigSection(config: Record<string, unknown>): string {
  const yaml = require("js-yaml") as typeof import("js-yaml");
  const semanticConfig = toSemanticNoteConfig(toNoteConfigKeys(config));
  const yamlStr = yaml.dump(withRendererConfigVersion(semanticConfig), {
    indent: 2,
    lineWidth: -1,
    sortKeys: false,
  });
  return `\n## renderer_config\n\n\`\`\`yaml\n${yamlStr}\`\`\`\n`;
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
