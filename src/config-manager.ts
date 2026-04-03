/**
 * config-manager.ts — Unified render config merge / extraction helpers.
 *
 * Note-level renderer_config support has been removed. The only remaining
 * source of truth is the plugin fallback config plus optional preset values.
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

function deepCopyEffects(effects: Record<string, EffectParams>): Record<string, EffectParams> {
  return Object.fromEntries(
    Object.entries(effects).map(([name, params]) => [name, { ...params }]),
  );
}

export { extractRenderOptions, buildCoverConfig, RENDER_KEYS, RENDER_DEFAULTS };
export type { RenderOptions, RenderKey, CoverConfig };
