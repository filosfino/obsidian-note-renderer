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
  validateNoteConfig,
  type RenderOptions,
  type RenderKey,
  type EffectParams,
  type CoverConfig,
} from "./schema";

import { parseRendererConfig } from "./parser";
import { migrateRendererConfig } from "./config-migrations";

import type { RendererConfig } from "./plugin-types";

export interface ResolvedRenderConfig {
  settings: RendererConfig;
  options: RenderOptions;
  cover: CoverConfig;
}

export interface NoteConfigMetadata {
  activePreset?: string;
}

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
  parseError: boolean;
}

// ── Read ────────────────────────────────────────────────────────────────────

/** Parse renderer_config from markdown. Returns null if absent or invalid. */
export function readNoteConfig(markdown: string): Partial<RenderOptions> | null {
  return parseRendererConfig(markdown) as Partial<RenderOptions> | null;
}

/** Read note renderer_config and return the latest grouped note-facing schema. */
export function readGroupedNoteConfig(markdown: string): Record<string, unknown> | null {
  const noteConfig = readNoteConfig(markdown);
  const metadata = readNoteConfigMetadata(markdown);
  if (!noteConfig) {
    return metadata.activePreset ? buildFrontmatterRendererConfig({}, metadata) : null;
  }
  return buildFrontmatterRendererConfig(noteConfig, metadata);
}

export function readNoteConfigMetadata(markdown: string): NoteConfigMetadata {
  const frontmatter = parseFrontmatter(markdown);
  const config = frontmatter.data.renderer_config;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  const raw = config as Record<string, unknown>;
  const activePreset = typeof raw.presetName === "string" && raw.presetName
    ? raw.presetName
    : raw.activePreset;
  return typeof activePreset === "string" && activePreset
    ? { activePreset }
    : {};
}

/**
 * Merge plugin defaults with per-note overrides.
 * Note config values win; missing keys fall back to plugin settings.
 * Deep-merges coverEffects/bodyEffects (per-effect override, not all-or-nothing).
 */
export function mergeConfigs(
  global: RendererConfig,
  noteConfig: Partial<RenderOptions> | null,
): RendererConfig {
  const merged: RendererConfig = {
    ...global,
    coverEffects: deepCopyEffects(global.coverEffects),
    bodyEffects: deepCopyEffects(global.bodyEffects),
  };
  if (!noteConfig) return merged;
  const mergedMutable = merged as Record<string, unknown>;

  for (const [key, value] of Object.entries(noteConfig)) {
    if (!(key in merged) || value === undefined || value === null) continue;

    if ((key === "coverEffects" || key === "bodyEffects") && typeof value === "object") {
      const target = merged[key];
      // Deep merge: note overrides individual effects, rest kept from plugin defaults
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- value is narrowed from unknown
      for (const [name, params] of Object.entries(value as Record<string, EffectParams>)) {
        if (name in target) {
          target[name] = { ...target[name], ...params };
        }
      }
    } else {
      mergedMutable[key] = value;
    }
  }
  return merged;
}

export function resolveMergedRenderConfig(
  global: RendererConfig,
  noteConfig: Partial<RenderOptions> | null,
): ResolvedRenderConfig {
  const merged = mergeConfigs(global, noteConfig);
  const settings = extractRenderOptions(merged) as RendererConfig;
  const options = settings;
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
  metadata?: NoteConfigMetadata,
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

  return writeFrontmatter(markdown, noteConfig, metadata ?? readNoteConfigMetadata(markdown));
}

/**
 * Save full render options as renderer_config into markdown.
 * Returns the modified markdown string.
 */
export function saveFullNoteConfig(
  markdown: string,
  options: RenderOptions,
  metadata?: NoteConfigMetadata,
): string {
  return writeFrontmatter(markdown, options, metadata ?? readNoteConfigMetadata(markdown));
}

export function savePresetReferenceToNote(
  markdown: string,
  presetName: string,
): string {
  return writeFrontmatter(markdown, {}, { activePreset: presetName });
}

/**
 * Save note-facing renderer_config object into markdown.
 * Accepts grouped or legacy flat config, normalizes it, then writes grouped schema.
 */
export function writeGroupedNoteConfig(
  markdown: string,
  rendererConfig: Record<string, unknown>,
): string {
  const migrated = migrateRendererConfig({ ...rendererConfig });
  const validated = validateNoteConfig(migrated);
  return writeFrontmatter(markdown, validated as Record<string, unknown>, extractMetadata(rendererConfig));
}

/** Remove renderer_config section from markdown. Returns modified markdown. */
export function removeNoteConfig(markdown: string): string {
  return writeFrontmatter(markdown, null);
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

function buildFrontmatterRendererConfig(
  config: Record<string, unknown>,
  metadata: NoteConfigMetadata = {},
): Record<string, unknown> {
  const normalized = toNoteConfigKeys(config);
  const hasConfig = Object.keys(normalized).length > 0;
  return {
    ...(hasConfig ? withRendererConfigVersion(toSemanticNoteConfig(normalized)) : {}),
    ...(metadata.activePreset ? { presetName: metadata.activePreset } : {}),
  };
}

function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const yaml = require("js-yaml") as typeof import("js-yaml");
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, body: markdown, hasFrontmatter: false, parseError: false };

  let data: Record<string, unknown> = {};
  let parseError = false;
  try {
    const parsed = yaml.load(match[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    parseError = true;
  }

  return {
    data,
    body: markdown.slice(match[0].length),
    hasFrontmatter: true,
    parseError,
  };
}

function writeFrontmatter(
  markdown: string,
  rendererConfig: Record<string, unknown> | null,
  metadata: NoteConfigMetadata = {},
): string {
  const yaml = require("js-yaml") as typeof import("js-yaml");
  const { data, body, hasFrontmatter, parseError } = parseFrontmatter(markdown);
  if (hasFrontmatter && parseError) {
    return markdown;
  }
  const next = { ...data };

  if (rendererConfig) {
    const built = buildFrontmatterRendererConfig(rendererConfig, metadata);
    if (Object.keys(built).length > 0) {
      next.renderer_config = built;
    } else {
      delete next.renderer_config;
    }
  } else {
    delete next.renderer_config;
  }

  const cleanedBody = removeConfigSection(body).replace(/^\n+/, "");
  if (Object.keys(next).length === 0) {
    return cleanedBody.trimStart();
  }

  const yamlStr = yaml.dump(next, {
    indent: 2,
    lineWidth: -1,
    sortKeys: false,
  });
  return `---\n${yamlStr}---\n\n${cleanedBody}`;
}

/** Remove `## renderer_config` section (and its content) from markdown. */
function removeConfigSection(markdown: string): string {
  return markdown.replace(/(?:^|\n)## renderer_config\n[\s\S]*?(?=\n## |\n*$)/, "").trimEnd() + "\n";
}

function extractMetadata(source: Record<string, unknown>): NoteConfigMetadata {
  const activePreset = typeof source.presetName === "string" && source.presetName
    ? source.presetName
    : source.activePreset;
  return typeof activePreset === "string" && activePreset
    ? { activePreset }
    : {};
}
