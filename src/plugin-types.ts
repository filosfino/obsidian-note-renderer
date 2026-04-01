import { RENDER_DEFAULTS, RENDER_KEYS, type RenderOptions } from "./schema";
import type { FontEntry } from "./fonts";

export type RendererConfig = RenderOptions;
export type RendererPreset = RendererConfig;

export interface RendererPresetEntry {
  values: Partial<RendererPreset>;
  locked: boolean;
}

export interface PluginUiState {
  activePreset: string;
  presets: Record<string, RendererPresetEntry>;
  customFonts: FontEntry[];
}

export const PRESET_KEYS = RENDER_KEYS;

export const DEFAULT_PLUGIN_UI_STATE: PluginUiState = {
  activePreset: "",
  presets: {},
  customFonts: [],
};

export function createDefaultRendererConfig(): RendererConfig {
  return {
    ...RENDER_DEFAULTS,
    coverEffects: { ...RENDER_DEFAULTS.coverEffects },
  };
}
