/**
 * config-manager.ts — Unified render config merge / extraction helpers.
 *
 * Primary flow uses plugin fallback config plus optional presets.
 * A lightweight note-level renderer_config frontmatter layer is still supported
 * for explicit save/remove actions in the preview UI.
 */

import {
  RENDER_DEFAULTS,
  RENDER_KEYS,
  extractRenderOptions,
  buildCoverConfig,
  type RenderOptions,
  type RenderKey,
  type EffectParams,
  type CoverConfig,
} from "./schema";

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

/**
 * Merge a base renderer config with a partial override.
 * Deep-merges coverEffects/bodyEffects so presets can override individual effects.
 */
export function mergeConfigs(
  global: RendererConfig,
  override: Partial<RenderOptions> | null,
): RendererConfig {
  const merged: RendererConfig = {
    ...global,
    coverEffects: deepCopyEffects(global.coverEffects),
    bodyEffects: deepCopyEffects(global.bodyEffects),
  };
  if (!override) return merged;

  const mutable = merged as Record<string, unknown>;
  for (const [key, value] of Object.entries(override)) {
    if (!(key in merged) || value === undefined || value === null) continue;

    if ((key === "coverEffects" || key === "bodyEffects") && typeof value === "object") {
      const target = merged[key];
      for (const [name, params] of Object.entries(value as Record<string, EffectParams>)) {
        if (name in target) {
          target[name] = { ...target[name], ...params };
        }
      }
      continue;
    }

    mutable[key] = value;
  }

  return merged;
}

export function resolveMergedRenderConfig(
  global: RendererConfig,
  override: Partial<RenderOptions> | null = null,
): ResolvedRenderConfig {
  const merged = mergeConfigs(global, override);
  const settings = extractRenderOptions(merged) as RendererConfig;
  const options = settings;
  const cover = buildCoverConfig(options);
  return { settings, options, cover };
}

export function readNoteConfig(markdown: string): Partial<RenderOptions> | null {
  const frontmatter = parseFrontmatter(markdown);
  const config = frontmatter.data.renderer_config;
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const { presetName, activePreset, ...rest } = config as Record<string, unknown>;
  void presetName;
  void activePreset;
  return rest as Partial<RenderOptions>;
}

export function readNoteConfigMetadata(markdown: string): NoteConfigMetadata {
  const frontmatter = parseFrontmatter(markdown);
  const config = frontmatter.data.renderer_config;
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};

  const raw = config as Record<string, unknown>;
  const activePreset = typeof raw.presetName === "string" && raw.presetName
    ? raw.presetName
    : raw.activePreset;
  return typeof activePreset === "string" && activePreset
    ? { activePreset }
    : {};
}

export function saveNoteConfig(
  markdown: string,
  options: RenderOptions,
  metadata: NoteConfigMetadata = {},
  baseOptions: Partial<RenderOptions> | null = null,
): string {
  const payload = metadata.activePreset
    ? diffConfig(baseOptions ?? {}, options)
    : options;
  return writeFrontmatter(markdown, payload, metadata);
}

export function savePresetReferenceToNote(markdown: string, presetName: string): string {
  return writeFrontmatter(markdown, {}, { activePreset: presetName });
}

export function removeNoteConfig(markdown: string): string {
  return writeFrontmatter(markdown, null);
}

function deepCopyEffects(effects: Record<string, EffectParams>): Record<string, EffectParams> {
  return Object.fromEntries(
    Object.entries(effects).map(([name, params]) => [name, { ...params }]),
  );
}

function diffConfig(
  base: Partial<RenderOptions>,
  next: RenderOptions,
): Partial<RenderOptions> {
  const diff: Partial<RenderOptions> = {};
  const mutable = diff as Record<string, unknown>;

  for (const key of RENDER_KEYS) {
    const nextValue = next[key];
    const baseValue = base[key];

    if ((key === "coverEffects" || key === "bodyEffects")
      && nextValue && typeof nextValue === "object"
      && baseValue && typeof baseValue === "object") {
      const effectDiff = diffEffects(
        baseValue as Record<string, EffectParams>,
        nextValue as Record<string, EffectParams>,
      );
      if (Object.keys(effectDiff).length > 0) {
        mutable[key] = effectDiff;
      }
      continue;
    }

    if (JSON.stringify(baseValue) !== JSON.stringify(nextValue)) {
      mutable[key] = nextValue;
    }
  }

  return diff;
}

function diffEffects(
  base: Record<string, EffectParams>,
  next: Record<string, EffectParams>,
): Record<string, Partial<EffectParams>> {
  const diff: Record<string, Partial<EffectParams>> = {};

  for (const [name, params] of Object.entries(next)) {
    const baseParams = base[name];
    const paramDiff: Partial<EffectParams> = {};
    for (const [paramKey, paramValue] of Object.entries(params)) {
      if (!baseParams || JSON.stringify(baseParams[paramKey as keyof EffectParams]) !== JSON.stringify(paramValue)) {
        paramDiff[paramKey as keyof EffectParams] = paramValue;
      }
    }
    if (Object.keys(paramDiff).length > 0) {
      diff[name] = paramDiff;
    }
  }

  return diff;
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
  if (hasFrontmatter && parseError) return markdown;

  const next = { ...data };
  const payload = {
    ...(rendererConfig ?? {}),
    ...(metadata.activePreset ? { presetName: metadata.activePreset } : {}),
  };
  if (Object.keys(payload).length > 0) {
    next.renderer_config = payload;
  } else {
    delete next.renderer_config;
  }

  const cleanedBody = body.replace(/^\n+/, "");
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

export { extractRenderOptions, buildCoverConfig, RENDER_KEYS, RENDER_DEFAULTS };
export type { RenderOptions, RenderKey, CoverConfig };
