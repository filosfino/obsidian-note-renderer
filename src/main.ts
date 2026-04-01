import { Plugin, normalizePath, Notice, TFile } from "obsidian";
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
import {
  migrateSettings,
  readGroupedNoteConfig,
  readNoteConfig,
  resolveMergedRenderConfig,
  writeGroupedNoteConfig,
} from "./config-manager";
import { renderNote } from "./renderer";
import { exportSinglePage, scaleBlob } from "./exporter";
import { DEFAULT_FONTS, getFontDisplayName, type FontEntry } from "./fonts";

// ── Types (derived from schema) ──────────────────────────────────────────────

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

type PresetValues = Partial<RendererPreset>;

type PersistedNoteRendererSettings = PluginUiState;

// Preset keys = all render keys (auto-derived)
export const PRESET_KEYS = RENDER_KEYS;

const DEFAULT_PERSISTED_SETTINGS: PersistedNoteRendererSettings = {
  activePreset: "",
  presets: {},
  customFonts: [],
};

// ── Plugin ───────────────────────────────────────────────────────────────────

export default class NoteRendererPlugin extends Plugin {
  private pluginState: PluginUiState = { ...DEFAULT_PERSISTED_SETTINGS };
  private fallbackRenderConfig: RendererConfig = { ...RENDER_DEFAULTS, coverEffects: { ...RENDER_DEFAULTS.coverEffects } };

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

  getFallbackRenderConfig(): RendererConfig {
    return this.fallbackRenderConfig;
  }

  setFallbackRenderValue<K extends keyof RendererConfig>(key: K, value: RendererConfig[K]): void {
    this.fallbackRenderConfig[key] = value;
  }

  getActivePresetName(): string {
    return this.pluginState.activePreset;
  }

  setActivePresetName(name: string): void {
    this.pluginState.activePreset = name;
  }

  clearActivePreset(): void {
    this.pluginState.activePreset = "";
  }

  getCustomFonts(): FontEntry[] {
    return this.pluginState.customFonts;
  }

  setCustomFonts(fonts: FontEntry[]): void {
    this.pluginState.customFonts = fonts;
  }

  getPresetEntry(name: string): RendererPresetEntry | undefined {
    return this.pluginState.presets[name];
  }

  getPresetValues(name: string): Partial<RendererPreset> | undefined {
    return this.getPresetEntry(name)?.values;
  }

  replacePluginState(state: PluginUiState): void {
    this.pluginState = {
      activePreset: state.activePreset,
      presets: state.presets,
      customFonts: state.customFonts,
    };
  }

  // ── Preset management ──

  /** Snapshot current settings (excluding meta fields) as a named preset. */
  savePreset(name: string, source?: Partial<RendererPreset>): boolean {
    const existing = this.pluginState.presets[name];
    if (existing?.locked) return false;

    const preset: Partial<RendererPreset> = {};
    const presetMutable = preset as Record<string, unknown>;
    for (const key of RENDER_KEYS) {
      presetMutable[key] = source?.[key] ?? this.getFallbackRenderValue(key);
    }
    this.pluginState.presets[name] = {
      values: preset,
      locked: existing?.locked ?? false,
    };
    this.setActivePresetName(name);
    return true;
  }

  /** Apply a preset's values to current settings. Falls back to defaults for missing keys. */
  loadPreset(name: string): void {
    const preset = this.getPresetValues(name);
    if (!preset) return;
    for (const key of RENDER_KEYS) {
      this.setFallbackRenderValue(
        key,
        this.getPresetValueOrDefault(preset, key),
      );
    }
    this.setActivePresetName(name);
  }

  /** Delete a preset by name. Clears activePreset if it was the deleted one. */
  deletePreset(name: string): void {
    delete this.pluginState.presets[name];
    if (this.getActivePresetName() === name) {
      this.clearActivePreset();
    }
  }

  getPresetNames(): string[] {
    return Object.keys(this.pluginState.presets);
  }

  getPresetDisplayName(name: string): string {
    return `${name}${this.isPresetLocked(name) ? " 🔒" : ""}`;
  }

  isPresetLocked(name: string): boolean {
    return this.getPresetEntry(name)?.locked ?? false;
  }

  togglePresetLock(name: string): boolean {
    const preset = this.getPresetEntry(name);
    if (!preset) return false;
    preset.locked = !preset.locked;
    return preset.locked;
  }

  private getFallbackRenderValue<K extends keyof RendererConfig>(key: K): RendererConfig[K] {
    return this.fallbackRenderConfig[key];
  }

  private getDefaultRenderValue<K extends keyof RendererConfig>(key: K): RendererConfig[K] {
    return RENDER_DEFAULTS[key];
  }

  private getPresetValueOrDefault<K extends keyof RendererConfig>(
    preset: PresetValues | undefined,
    key: K,
  ): RendererConfig[K] {
    return preset?.[key] ?? this.getDefaultRenderValue(key);
  }

  // ── Headless render API ──

  /**
   * Render a markdown file to PNG images and save to a directory.
   * Uses the note's renderer_config, falling back to plugin defaults when absent.
   *
   * @param filePath - vault-relative path, e.g. "4.projects/小红书分享/notes/xxx.md"
   * @param outputDir - absolute filesystem path, e.g. "/tmp/nr-output"
   * @param scale - output scale factor (0-1, default 1). 0.5 = 50% size.
   * @returns array of output file paths
   *
   * Usage via Obsidian CLI:
   *   obsidian eval code="await app.plugins.plugins['note-renderer'].renderToFiles('path/to/note.md', '/tmp/output')"
   *   obsidian eval code="await app.plugins.plugins['note-renderer'].renderToFiles('path/to/note.md', '/tmp/output', 0.5)"
   */
  async renderToFiles(filePath: string, outputDir: string, scale?: number): Promise<string[]> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      throw new Error(`Not a markdown file: ${filePath}`);
    }

    const markdown = await this.app.vault.read(file);
    const noteConfig = readNoteConfig(markdown);
    const resolved = resolveMergedRenderConfig(this.getFallbackRenderConfig(), noteConfig);
    const themeCss = await this.loadTheme(resolved.settings.activeTheme);

    const rendered = await renderNote(this.app, markdown, file.path, themeCss, resolved.settings.activeTheme, this, resolved.options);

    // Ensure output directory exists
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPaths: string[] = [];
    const baseName = file.basename;

    for (let i = 0; i < rendered.pages.length; i++) {
      const pageNum = String(i + 1).padStart(2, "0");
      const pngName = `${baseName}_${pageNum}`;
      const outPath = path.join(outputDir, `${pngName}.png`);
      await this.writeRenderedPageToFile(rendered.pages[i], pngName, outPath, scale);
      outputPaths.push(outPath);
    }

    rendered.cleanup();
    new Notice(`Rendered ${rendered.pages.length} pages → ${outputDir}`);
    return outputPaths;
  }

  /**
   * Read renderer_config from a note and return the latest grouped note-facing schema.
   *
   * Usage via Obsidian CLI:
   *   obsidian eval code="JSON.stringify(await app.plugins.plugins['note-renderer'].loadRendererConfigFromNote('path/to/note.md'), null, 2)"
   */
  async loadRendererConfigFromNote(noteFilePath: string): Promise<Record<string, unknown> | null> {
    const file = this.getMarkdownFile(noteFilePath);
    const markdown = await this.app.vault.read(file);
    return readGroupedNoteConfig(markdown);
  }

  /**
   * Write renderer_config to a note.
   * Accepts grouped or legacy flat config and always writes grouped schema.
   *
   * Usage via Obsidian CLI:
   *   obsidian eval code="await app.plugins.plugins['note-renderer'].writeRendererConfigToNote('path/to/note.md', { theme: 'cream', cover: { typography: { align: 'center' } } })"
   */
  async writeRendererConfigToNote(noteFilePath: string, rendererConfig: Record<string, unknown>): Promise<Record<string, unknown>> {
    const file = this.getMarkdownFile(noteFilePath);
    const markdown = await this.app.vault.read(file);
    const updated = writeGroupedNoteConfig(markdown, rendererConfig);
    await this.app.vault.modify(file, updated);
    return (await this.loadRendererConfigFromNote(noteFilePath)) ?? {};
  }

  /**
   * 渲染指定页面到文件。
   *
   * @param filePath - vault 内的 markdown 文件相对路径
   * @param pageIndex - 页码（从 1 开始）
   * @param outputDir - 输出目录
   * @param scale - 输出缩放比例（0-1，默认 1）。0.5 = 50% 尺寸。
   * @returns 输出文件路径
   *
   * Usage via Obsidian CLI:
   *   obsidian eval code="await app.plugins.plugins['note-renderer'].renderPage('path/to/note.md', 2, '/tmp/output')"
   *   obsidian eval code="await app.plugins.plugins['note-renderer'].renderPage('path/to/note.md', 2, '/tmp/output', 0.5)"
   */
  async renderPage(filePath: string, pageIndex: number, outputDir: string, scale?: number): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      throw new Error(`Not a markdown file: ${filePath}`);
    }

    const markdown = await this.app.vault.read(file);
    const noteConfig = readNoteConfig(markdown);
    const resolved = resolveMergedRenderConfig(this.getFallbackRenderConfig(), noteConfig);
    const themeCss = await this.loadTheme(resolved.settings.activeTheme);

    const rendered = await renderNote(this.app, markdown, file.path, themeCss, resolved.settings.activeTheme, this, resolved.options);

    const totalPages = rendered.pages.length;
    if (pageIndex < 1 || pageIndex > totalPages) {
      rendered.cleanup();
      throw new Error(`pageIndex ${pageIndex} out of range (total ${totalPages} pages)`);
    }

    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    fs.mkdirSync(outputDir, { recursive: true });

    const pageNum = String(pageIndex).padStart(2, "0");
    const pngName = `${file.basename}_${pageNum}`;
    const outPath = path.join(outputDir, `${pngName}.png`);
    await this.writeRenderedPageToFile(rendered.pages[pageIndex - 1], pngName, outPath, scale);

    rendered.cleanup();
    new Notice(`Rendered page ${pageIndex}/${totalPages} → ${outPath}`);
    return outPath;
  }

  async loadSettings(): Promise<void> {
    const raw = await this.loadData();
    const migrated = raw ? migrateSettings({ ...raw }) : {};
    const persisted = this.extractPersistedSettings(migrated);
    this.fallbackRenderConfig = { ...RENDER_DEFAULTS, coverEffects: { ...RENDER_DEFAULTS.coverEffects } };
    this.pluginState = {
      activePreset: persisted.activePreset,
      presets: persisted.presets,
      customFonts: persisted.customFonts,
    };

    // Also migrate presets
    if (this.pluginState.presets) {
      for (const [name, preset] of Object.entries(this.pluginState.presets as Record<string, RendererPresetEntry | Partial<RendererPreset>>)) {
        const isEntry = typeof preset === "object" && preset !== null && "values" in preset;
        const values = isEntry ? preset.values : preset;
        this.pluginState.presets[name] = {
          values: migrateSettings({ ...values }) as Partial<RendererPreset>,
          locked: isEntry ? Boolean(preset.locked) : false,
        };
      }
    }

    // Ensure customFonts exists (migration from older data.json)
    this.pluginState.customFonts ??= [];

    // Auto-import fonts used in current settings and presets into customFonts
    this.importUsedFonts();

    const activePreset = this.getActivePresetName();
    if (activePreset && !this.getPresetEntry(activePreset)) {
      this.clearActivePreset();
    }

    // Persist migrated settings so data.json gets updated
    await this.saveSettings();
  }

  /** Auto-add fonts from current settings and presets into customFonts if not already in default list */
  private importUsedFonts(): void {
    const defaultValues = new Set(DEFAULT_FONTS.map(f => f.value));
    const customValues = new Set(this.pluginState.customFonts.map(f => f.value));

    const maybeAdd = (value: string) => {
      if (!value || defaultValues.has(value) || customValues.has(value)) return;
      // Extract primary font name from CSS font-family for the label
      const match = value.match(/^"([^"]+)"/);
      const label = match ? getFontDisplayName(match[1]) : value.split(",")[0].trim();
      this.pluginState.customFonts.push({ label, value });
      customValues.add(value);
    };

    // Current settings
    const fallback = this.getFallbackRenderConfig();
    maybeAdd(fallback.fontFamily);
    maybeAdd(fallback.coverFontFamily);

    // All presets
    for (const preset of Object.values(this.pluginState.presets)) {
      if (preset.values.fontFamily) maybeAdd(preset.values.fontFamily);
      if (preset.values.coverFontFamily) maybeAdd(preset.values.coverFontFamily);
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.toPersistedSettings());
  }

  private extractPersistedSettings(raw: Record<string, unknown>): PersistedNoteRendererSettings {
    return {
      activePreset: typeof raw.activePreset === "string" ? raw.activePreset : DEFAULT_PERSISTED_SETTINGS.activePreset,
      presets: raw.presets && typeof raw.presets === "object"
        ? raw.presets as PersistedNoteRendererSettings["presets"]
        : DEFAULT_PERSISTED_SETTINGS.presets,
      customFonts: Array.isArray(raw.customFonts)
        ? raw.customFonts as PersistedNoteRendererSettings["customFonts"]
        : DEFAULT_PERSISTED_SETTINGS.customFonts,
    };
  }

  private toPersistedSettings(): PersistedNoteRendererSettings {
    return {
      activePreset: this.pluginState.activePreset,
      presets: this.pluginState.presets,
      customFonts: this.pluginState.customFonts,
    };
  }

  private getMarkdownFile(filePath: string): TFile {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      throw new Error(`Not a markdown file: ${filePath}`);
    }
    return file;
  }

  private async writeRenderedPageToFile(
    page: HTMLElement,
    pngName: string,
    outPath: string,
    scale?: number,
  ): Promise<void> {
    const blob = await exportSinglePage(page, pngName);
    const finalBlob = scale !== undefined && scale > 0 && scale < 1
      ? await scaleBlob(blob, scale)
      : blob;
    const buffer = Buffer.from(await finalBlob.arrayBuffer());
    const fs = require("fs") as typeof import("fs");
    fs.writeFileSync(outPath, buffer);
  }
}
