import { Plugin, normalizePath } from "obsidian";
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

import { RENDER_DEFAULTS, RENDER_KEYS, type RenderOptions } from "./schema";
import { migrateSettings } from "./config-manager";
import { DEFAULT_FONTS, getFontDisplayName, type FontEntry } from "./fonts";

// ── Types (derived from schema) ──────────────────────────────────────────────

export type RendererPreset = RenderOptions;

export interface NoteRendererSettings extends RenderOptions {
  activePreset: string;
  presets: Record<string, Partial<RendererPreset>>;
  customFonts: FontEntry[];
}

// Preset keys = all render keys (auto-derived)
export const PRESET_KEYS = RENDER_KEYS;

const DEFAULT_SETTINGS: NoteRendererSettings = {
  ...RENDER_DEFAULTS,
  activePreset: "",
  presets: {},
  customFonts: [],
};

// ── Plugin ───────────────────────────────────────────────────────────────────

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
      callback: async () => { await this.activateView(); },
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

    this.addCommand({
      id: "prev-page",
      name: "Previous page",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
        if (view instanceof PreviewView) view.goPage(-1);
      },
    });

    this.addCommand({
      id: "next-page",
      name: "Next page",
      callback: () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
        if (view instanceof PreviewView) view.goPage(1);
      },
    });

    this.addCommand({
      id: "export-current-page",
      name: "Export current page",
      callback: async () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
        if (view instanceof PreviewView) await view.handleExportCurrentPage();
      },
    });

    this.addCommand({
      id: "export-all",
      name: "Export all pages (zip)",
      callback: async () => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
        if (view instanceof PreviewView) await view.handleExport();
      },
    });

    this.addRibbonIcon("image", "Note renderer", async () => { await this.activateView(); });
  }

  onunload(): void {
    this.themeCache.clear();
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      void this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      void this.app.workspace.revealLeaf(leaf);
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
    const themesDir = normalizePath(`${this.manifest.dir}/themes`);

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
    for (const key of RENDER_KEYS) {
      preset[key] = (this.settings as Record<string, unknown>)[key];
    }
    this.settings.presets[name] = preset as RendererPreset;
    this.settings.activePreset = name;
  }

  /** Apply a preset's values to current settings. Falls back to defaults for missing keys. */
  loadPreset(name: string): void {
    const preset = this.settings.presets[name];
    if (!preset) return;
    for (const key of RENDER_KEYS) {
      const val = (preset as Record<string, unknown>)[key];
      (this.settings as Record<string, unknown>)[key] = val !== undefined ? val : (RENDER_DEFAULTS as Record<string, unknown>)[key];
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
    const migrated = raw ? migrateSettings({ ...raw }) : {};

    // Deep merge: Object.assign is shallow, so coverEffects needs special handling
    const defaultEffects = { ...RENDER_DEFAULTS.coverEffects };
    for (const [name, params] of Object.entries(defaultEffects)) {
      defaultEffects[name] = { ...params };
    }
    this.settings = Object.assign({}, DEFAULT_SETTINGS, migrated);
    // Merge coverEffects: defaults + migrated (migrated may be incomplete)
    if (migrated.coverEffects && typeof migrated.coverEffects === "object") {
      const merged: Record<string, { enabled: boolean; opacity: number }> = { ...defaultEffects };
      for (const [name, params] of Object.entries(migrated.coverEffects as Record<string, { enabled: boolean; opacity: number }>)) {
        if (name in merged) {
          merged[name] = { ...merged[name], ...params };
        }
      }
      this.settings.coverEffects = merged;
    } else {
      this.settings.coverEffects = defaultEffects;
    }

    // Also migrate presets
    if (this.settings.presets) {
      for (const [name, preset] of Object.entries(this.settings.presets)) {
        this.settings.presets[name] = migrateSettings({ ...preset as Record<string, unknown> }) as Partial<RendererPreset>;
      }
    }

    // Ensure customFonts exists (migration from older data.json)
    this.settings.customFonts ??= [];

    // Auto-import fonts used in current settings and presets into customFonts
    this.importUsedFonts();

    // Persist migrated settings so data.json gets updated
    await this.saveSettings();
  }

  /** Auto-add fonts from current settings and presets into customFonts if not already in default list */
  private importUsedFonts(): void {
    const defaultValues = new Set(DEFAULT_FONTS.map(f => f.value));
    const customValues = new Set(this.settings.customFonts.map(f => f.value));

    const maybeAdd = (value: string) => {
      if (!value || defaultValues.has(value) || customValues.has(value)) return;
      // Extract primary font name from CSS font-family for the label
      const match = value.match(/^"([^"]+)"/);
      const label = match ? getFontDisplayName(match[1]) : value.split(",")[0].trim();
      this.settings.customFonts.push({ label, value });
      customValues.add(value);
    };

    // Current settings
    maybeAdd(this.settings.fontFamily);
    maybeAdd(this.settings.coverFontFamily);

    // All presets
    for (const preset of Object.values(this.settings.presets)) {
      if (preset.fontFamily) maybeAdd(preset.fontFamily);
      if (preset.coverFontFamily) maybeAdd(preset.coverFontFamily);
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
