import { Plugin } from "obsidian";
import { VIEW_TYPE } from "./constants";
import { PreviewView } from "./preview-view";
import { THEME_PAPER } from "./themes/paper";
import { THEME_GRAPHITE } from "./themes/graphite";
import { THEME_INK_GOLD } from "./themes/ink-gold";
import { THEME_AMBER } from "./themes/amber";
import { THEME_CREAM } from "./themes/cream";
import { THEME_LATTE } from "./themes/latte";
import { THEME_SAGE } from "./themes/sage";
import { THEME_MIST } from "./themes/mist";
import { THEME_ROSE } from "./themes/rose";

import type { PageMode, CoverStrokeStyle } from "./constants";

// Preset: a named snapshot of all rendering parameters (theme + params)
export interface RendererPreset {
  activeTheme: string;
  fontSize: number;
  fontFamily: string;
  coverFontFamily: string;
  coverStrokePercent: number;
  coverStrokeStyle: CoverStrokeStyle;
  coverStrokeOpacity: number;
  coverGlowSize: number;
  coverBanner: boolean;
  coverBannerColor: string;
  coverBannerSkew: number;
  coverFontColor: string;
  coverFontScale: number;
  coverLetterSpacing: number;
  coverLineHeight: number;
  coverOffsetX: number;
  coverOffsetY: number;
  coverOverlay: boolean;
  coverShadow: boolean;
  coverShadowBlur: number;
  coverShadowOffsetX: number;
  coverShadowOffsetY: number;
  pageMode: PageMode;
}

export interface NoteRendererSettings {
  activeTheme: string;
  activePreset: string;                       // "" = no preset selected
  presets: Record<string, RendererPreset>;     // name → config snapshot
  fontSize: number;
  fontFamily: string;
  coverFontFamily: string;
  coverStrokePercent: number;
  coverStrokeStyle: CoverStrokeStyle;
  coverStrokeOpacity: number;   // stroke alpha 0-100 (90 = rgba 0.9)
  coverGlowSize: number;        // glow multiplier 0-200 (60 = 0.6x stroke width)
  coverBanner: boolean;         // independent banner toggle
  coverBannerColor: string;     // banner mode background color
  coverBannerSkew: number;      // parallelogram skew percentage (0 = rectangle, 15 = steep)
  coverFontColor: string;       // empty = use theme default
  coverFontScale: number;       // font size multiplier (100 = auto, 150 = 1.5x)
  coverLetterSpacing: number;   // in 0.01em units (e.g. 5 = 0.05em)
  coverLineHeight: number;      // in 0.1 units (e.g. 13 = 1.3)
  coverOffsetX: number;         // cover text X offset in % of page width (-50 to 50)
  coverOffsetY: number;         // cover text Y offset in % of page height (-50 to 50)
  coverOverlay: boolean;        // gradient overlay on cover image
  coverShadow: boolean;
  coverShadowBlur: number;
  coverShadowOffsetX: number;
  coverShadowOffsetY: number;
  pageMode: PageMode;
}

// Keys that are part of a preset (excludes meta fields like activePreset and presets)
export const PRESET_KEYS: (keyof RendererPreset)[] = [
  "activeTheme", "fontSize", "fontFamily", "coverFontFamily",
  "coverStrokePercent", "coverStrokeStyle", "coverStrokeOpacity", "coverGlowSize",
  "coverBanner", "coverBannerColor", "coverBannerSkew", "coverFontColor",
  "coverFontScale", "coverLetterSpacing", "coverLineHeight",
  "coverOffsetX", "coverOffsetY", "coverOverlay",
  "coverShadow", "coverShadowBlur", "coverShadowOffsetX", "coverShadowOffsetY",
  "pageMode",
];

const DEFAULT_SETTINGS: NoteRendererSettings = {
  activeTheme: "cream",
  activePreset: "",
  presets: {},
  fontSize: 42,
  fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
  coverFontFamily: '"Yuanti SC", "PingFang SC", sans-serif',
  coverStrokePercent: 20,
  coverStrokeStyle: "stroke",
  coverStrokeOpacity: 90,
  coverGlowSize: 60,
  coverBanner: false,
  coverBannerColor: "rgba(0,0,0,0.5)",
  coverBannerSkew: 6,
  coverFontColor: "",
  coverFontScale: 100,
  coverLetterSpacing: 5,
  coverLineHeight: 13,
  coverOffsetX: 0,
  coverOffsetY: 0,
  coverOverlay: true,
  coverShadow: true,
  coverShadowBlur: 16,
  coverShadowOffsetX: 0,
  coverShadowOffsetY: 4,
  pageMode: "long",
};

export default class NoteRendererPlugin extends Plugin {
  settings: NoteRendererSettings = DEFAULT_SETTINGS;

  // Theme cache: name → CSS string
  private themeCache: Map<string, string> = new Map();

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.indexThemes();

    this.registerView(VIEW_TYPE, (leaf) => new PreviewView(leaf, this));

    this.addCommand({
      id: "open-preview",
      name: "Open preview",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "render-current",
      name: "Render current note",
      callback: async () => {
        await this.activateView();
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
        if (view instanceof PreviewView) {
          await view.refresh();
        }
      },
    });

    this.addRibbonIcon("image", "Note Renderer", () => this.activateView());
  }

  onunload(): void {
    this.themeCache.clear();
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  async indexThemes(): Promise<void> {
    this.themeCache.clear();

    // Bundled themes
    this.themeCache.set("paper", THEME_PAPER);
    this.themeCache.set("graphite", THEME_GRAPHITE);
    this.themeCache.set("ink-gold", THEME_INK_GOLD);
    this.themeCache.set("amber", THEME_AMBER);
    this.themeCache.set("cream", THEME_CREAM);
    this.themeCache.set("latte", THEME_LATTE);
    this.themeCache.set("sage", THEME_SAGE);
    this.themeCache.set("mist", THEME_MIST);
    this.themeCache.set("rose", THEME_ROSE);

    // User themes from plugin directory
    const adapter = this.app.vault.adapter;
    const themesDir = `${this.manifest.dir}/themes`;

    if (await adapter.exists(themesDir)) {
      const listing = await adapter.list(themesDir);
      for (const filePath of listing.files) {
        if (filePath.endsWith(".css")) {
          const name = filePath.split("/").pop()!.replace(".css", "");
          const css = await adapter.read(filePath);
          this.themeCache.set(name, css);
        }
      }
    }
  }

  getThemeNames(): string[] {
    return Array.from(this.themeCache.keys());
  }

  async loadTheme(name: string): Promise<string> {
    if (!this.themeCache.has(name)) {
      await this.indexThemes();
    }
    return this.themeCache.get(name) ?? this.themeCache.get("cream") ?? "";
  }

  // ── Preset management ──

  /** Snapshot current settings (excluding meta fields) as a named preset. */
  savePreset(name: string): void {
    const preset: Record<string, unknown> = {};
    for (const key of PRESET_KEYS) {
      preset[key] = (this.settings as Record<string, unknown>)[key];
    }
    this.settings.presets[name] = preset as RendererPreset;
    this.settings.activePreset = name;
  }

  /** Apply a preset's values to current settings. */
  loadPreset(name: string): void {
    const preset = this.settings.presets[name];
    if (!preset) return;
    for (const key of PRESET_KEYS) {
      (this.settings as Record<string, unknown>)[key] = preset[key];
    }
    this.settings.activePreset = name;
  }

  /** Delete a preset by name. Clears activePreset if it was the deleted one. */
  deletePreset(name: string): void {
    delete this.settings.presets[name];
    if (this.settings.activePreset === name) {
      this.settings.activePreset = "";
    }
  }

  getPresetNames(): string[] {
    return Object.keys(this.settings.presets);
  }

  async loadSettings(): Promise<void> {
    const raw = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);

    // Migrate legacy key: activeTemplate → activeTheme
    if (raw && (raw as any).activeTemplate && !raw.activeTheme) {
      this.settings.activeTheme = (raw as any).activeTemplate;
    }
    // Clean up legacy key from runtime settings
    delete (this.settings as any).activeTemplate;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
