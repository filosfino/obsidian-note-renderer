import {
  ItemView,
  WorkspaceLeaf,
  TAbstractFile,
  Notice,
  debounce,
} from "obsidian";
import { VIEW_TYPE, PAGE_WIDTH, PAGE_HEIGHTS } from "./constants";
import { renderNote, RenderedPages } from "./renderer";
import { exportPages, exportSinglePage } from "./exporter";
import {
  readNoteConfig,
  mergeConfigs,
  updateNoteConfigKey,
  saveFullNoteConfig,
  removeNoteConfig,
  extractRenderOptions,
} from "./config-manager";
import type NoteRendererPlugin from "./main";
import { PRESET_KEYS } from "./main";
import type { NoteRendererSettings } from "./main";
import { buildSettingsPanel, type PanelHost, type PanelRefs } from "./settings-panel";

export class PreviewView extends ItemView implements PanelHost {
  plugin: NoteRendererPlugin;
  private pages: HTMLElement[] = [];
  private currentPage = 0;
  private rendered: RenderedPages | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private fileChangeHandler: ((file: TAbstractFile) => void) | null = null;
  private activeFileHandler: (() => void) | null = null;

  // Current displayed clone + wrapper (for rescaling without re-rendering)
  private currentClone: HTMLElement | null = null;
  private currentWrapper: HTMLElement | null = null;
  private coverCropOverlay: HTMLElement | null = null;
  private effectivePageMode: "long" | "card" = "long";

  // Guard: true while syncing UI from renderer_config, prevents change handlers from writing back to global settings
  syncing = false;

  // Note-config editing mode: when true, UI parameter changes write to note's renderer_config instead of global settings
  editingNoteConfig = false;
  // The effective settings (global merged with note config) — UI handlers read from this
  effective: NoteRendererSettings = {} as NoteRendererSettings;
  // Guard: true while writing note config, prevents file-change watcher from triggering refresh
  private writingNoteConfig = false;
  // When true, force using global config even when note has renderer_config (for comparison)
  private forceGlobalConfig = false;
  // Track whether current note actually has a renderer_config
  private hasNoteConfig = false;
  // Last stroke style before disabling
  lastStrokeStyle: string = "stroke";

  // Panel DOM refs
  private refs: PanelRefs | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: NoteRendererPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Note Renderer";
  }

  getIcon(): string {
    return "image";
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    this.refs = buildSettingsPanel(this, contentEl);

    // Mode indicator click handler (needs view-level state)
    this.refs.modeIndicator.addEventListener("click", async () => {
      if (!this.hasNoteConfig) return;
      this.forceGlobalConfig = !this.forceGlobalConfig;
      await this.refresh();
    });

    // ResizeObserver — rescale on sidebar width change
    this.resizeObserver = new ResizeObserver(() => {
      this.rescale();
    });
    this.resizeObserver.observe(this.refs.previewContainer);

    // Watch for file changes — auto-refresh when the current note is modified
    const debouncedRefresh = debounce(() => this.refresh(), 500, true);

    this.fileChangeHandler = (file: TAbstractFile) => {
      if (this.writingNoteConfig) return;
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && file.path === activeFile.path) {
        debouncedRefresh();
      }
    };
    this.app.vault.on("modify", this.fileChangeHandler);

    // Watch for active file change — refresh when switching notes
    this.activeFileHandler = () => {
      this.forceGlobalConfig = false;
      debouncedRefresh();
    };
    this.app.workspace.on("active-leaf-change", this.activeFileHandler as any);

    // Initial render
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.rendered?.cleanup();
    this.resizeObserver?.disconnect();
    if (this.fileChangeHandler) {
      this.app.vault.off("modify", this.fileChangeHandler);
    }
    if (this.activeFileHandler) {
      this.app.workspace.off("active-leaf-change", this.activeFileHandler as any);
    }
  }

  async refresh(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      this.showEmpty("Open a markdown file to preview");
      return;
    }

    const markdown = await this.app.vault.read(file);

    // Parse per-note renderer_config and merge with global settings
    const noteConfig = readNoteConfig(markdown);
    this.hasNoteConfig = !!noteConfig;

    // When forceGlobalConfig is on, skip merging note config (for comparison)
    const useNoteConfig = noteConfig && !this.forceGlobalConfig;
    const merged = mergeConfigs(this.plugin.settings, useNoteConfig ? noteConfig : null);

    // Store effective settings for UI handlers to read from
    this.effective = merged;

    // Update editing mode state — only edit note config when actually using it
    this.editingNoteConfig = !!useNoteConfig;

    // Update save/remove button visibility (based on actual note config existence, not force toggle)
    if (this.refs) {
      this.refs.saveToNoteBtn.style.display = noteConfig ? "none" : "";
      this.refs.removeFromNoteBtn.style.display = noteConfig ? "" : "none";
    }

    // Update mode indicator — show which config is being used for rendering
    if (this.refs) {
      const mi = this.refs.modeIndicator;
      if (!noteConfig) {
        mi.textContent = "⚙️ 全局配置";
        mi.title = "";
        mi.style.cursor = "default";
      } else if (this.forceGlobalConfig) {
        mi.textContent = "⚙️ 全局配置";
        mi.title = "点击切回笔记配置";
        mi.style.cursor = "pointer";
      } else {
        mi.textContent = "📌 笔记配置";
        mi.title = "点击查看全局配置效果";
        mi.style.cursor = "pointer";
      }
    }

    // Sync UI controls to reflect the effective (possibly overridden) settings
    this.syncUiToSettings(merged);

    this.effectivePageMode = merged.pageMode;
    const themeCss = await this.plugin.loadTheme(merged.activeTheme);

    this.rendered?.cleanup();
    this.rendered = await renderNote(
      this.app,
      markdown,
      file.path,
      themeCss,
      this.plugin,
      extractRenderOptions(merged as unknown as Record<string, unknown>),
    );

    this.pages = this.rendered.pages;
    // Hide overlay chip + params when no cover image
    if (this.refs) {
      const show = this.rendered.hasCoverImage;
      this.refs.overlayToggle.style.display = show ? "" : "none";
      if (this.refs.effectParamRows["overlay"]) {
        this.refs.effectParamRows["overlay"].style.display = show && this.effective.coverEffects?.overlay?.enabled ? "" : "none";
      }
    }
    // Preserve current page if possible, otherwise reset to 0
    if (this.currentPage >= this.pages.length) {
      this.currentPage = 0;
    }
    this.showPage();
  }

  /**
   * Route a setting change to global or note config depending on editing mode.
   * All UI handlers should call this instead of directly modifying plugin.settings.
   */
  async updateSetting<K extends keyof NoteRendererSettings>(
    key: K, value: NoteRendererSettings[K]
  ): Promise<void> {
    if (this.editingNoteConfig) {
      await this.updateNoteConfig(key as string, value);
    } else {
      this.plugin.settings[key] = value;
      // Clear active preset since user manually changed a setting
      if (key !== "activePreset") this.plugin.settings.activePreset = "";
      if (this.refs) this.refs.presetSelect.value = "";
      await this.plugin.saveSettings();
    }
    await this.refresh();
  }

  /**
   * Update a single key in the active note's renderer_config JSON.
   * Reads the note, modifies the JSON, writes it back.
   */
  async updateNoteConfig(key: string, value: unknown): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") return;

    const markdown = await this.app.vault.read(file);
    const updated = updateNoteConfigKey(markdown, key, value);
    if (updated === markdown) return;

    this.writingNoteConfig = true;
    await this.app.vault.modify(file, updated);
    setTimeout(() => { this.writingNoteConfig = false; }, 100);
  }

  /** Rebuild preset dropdown options from current settings. */
  rebuildPresetOptions(): void {
    if (!this.refs) return;
    const sel = this.refs.presetSelect;
    sel.empty();
    sel.createEl("option", { text: "(无预设)", value: "" });
    for (const name of this.plugin.getPresetNames()) {
      sel.createEl("option", { text: name, value: name });
    }
    sel.value = this.plugin.settings.activePreset;
  }

  /**
   * Check if the effective settings differ from the currently active preset.
   * Returns true if any PRESET_KEYS value in `s` differs from the saved preset.
   */
  private isPresetModified(s: NoteRendererSettings): boolean {
    const presetName = this.plugin.settings.activePreset;
    if (!presetName) return false;
    const preset = this.plugin.settings.presets[presetName];
    if (!preset) return false;
    for (const key of PRESET_KEYS) {
      const presetVal = (preset as Record<string, unknown>)[key];
      const currentVal = (s as Record<string, unknown>)[key];
      if (JSON.stringify(presetVal) !== JSON.stringify(currentVal)) {
        return true;
      }
    }
    return false;
  }

  /** Sync UI control display values to reflect effective settings (e.g. after renderer_config override). */
  private syncUiToSettings(s: NoteRendererSettings): void {
    if (!this.refs) return;
    this.syncing = true;
    const r = this.refs;

    // Preset selector: show "(modified)" if current settings differ from saved preset
    const presetName = this.plugin.settings.activePreset;
    r.presetSelect.value = presetName;
    if (presetName && this.isPresetModified(s)) {
      const selectedOpt = r.presetSelect.querySelector<HTMLOptionElement>(`option[value="${CSS.escape(presetName)}"]`);
      if (selectedOpt && !selectedOpt.text.endsWith(" (modified)")) {
        selectedOpt.text = `${presetName} (modified)`;
      }
    } else if (presetName) {
      const selectedOpt = r.presetSelect.querySelector<HTMLOptionElement>(`option[value="${CSS.escape(presetName)}"]`);
      if (selectedOpt && selectedOpt.text.endsWith(" (modified)")) {
        selectedOpt.text = presetName;
      }
    }

    r.themeSelect.value = s.activeTheme;
    r.modeSelect.value = s.pageMode;
    r.modeBtns.long.classList.toggle("nr-btn-active", s.pageMode === "long");
    r.modeBtns.card.classList.toggle("nr-btn-active", s.pageMode === "card");
    r.sizeInput.value = String(s.fontSize);
    r.fontSelect.value = s.fontFamily;
    r.coverFontSelect.value = s.coverFontFamily;
    r.scaleInput.value = String(s.coverFontScale);
    r.lsInput.value = String(s.coverLetterSpacing);
    r.lhInput.value = (s.coverLineHeight / 10).toFixed(1);
    r.strokeStyleSelect.value = s.coverStrokeStyle;
    r.strokeInput.value = String(s.coverStrokePercent);
    r.opInput.value = String(s.coverStrokeOpacity);
    r.glowInput.value = String(s.coverGlowSize);
    r.overlayToggle.classList.toggle("active", s.coverEffects?.overlay?.enabled ?? false);
    r.oxInput.value = String(s.coverOffsetX);
    r.oyInput.value = String(s.coverOffsetY);
    r.shadowToggle.classList.toggle("active", s.coverShadow);
    r.blurInput.value = String(s.coverShadowBlur);
    r.bannerToggle.classList.toggle("active", s.coverBanner);
    const strokeOn = s.coverStrokeStyle !== "none";
    r.strokeToggle.classList.toggle("active", strokeOn);
    r.strokeParamsRow.style.display = strokeOn ? "" : "none";
    r.bannerParamsRow.style.display = s.coverBanner ? "" : "none";
    r.shadowParamsRow.style.display = s.coverShadow ? "" : "none";
    const align = s.coverTextAlign ?? "left";
    r.alignBtns.left.classList.toggle("nr-btn-active", align === "left");
    r.alignBtns.center.classList.toggle("nr-btn-active", align === "center");
    r.alignBtns.right.classList.toggle("nr-btn-active", align === "right");

    this.syncing = false;
  }

  /** Save current UI settings as renderer_config into the active note. */
  async handleSaveToNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("No active markdown file");
      return;
    }
    const markdown = await this.app.vault.read(file);
    const options = extractRenderOptions(this.plugin.settings as unknown as Record<string, unknown>);
    const updated = saveFullNoteConfig(markdown, options);
    await this.app.vault.modify(file, updated);
    new Notice("已存入笔记");
  }

  /** Remove renderer_config section from the active note. */
  async handleRemoveFromNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("No active markdown file");
      return;
    }
    const markdown = await this.app.vault.read(file);
    const updated = removeNoteConfig(markdown);
    await this.app.vault.modify(file, updated);
    new Notice("已移除笔记配置");
  }

  private showPage(): void {
    if (!this.refs) return;

    this.refs.pageDisplay.empty();
    this.currentClone = null;
    this.currentWrapper = null;

    if (this.pages.length === 0) {
      this.showEmpty("No content to render");
      return;
    }

    const page = this.pages[this.currentPage];
    this.currentWrapper = this.refs.pageDisplay.createDiv("nr-page-wrapper");
    this.currentWrapper.style.position = "relative";

    this.currentClone = page.cloneNode(true) as HTMLElement;
    this.currentClone.style.transformOrigin = "top left";
    this.currentWrapper.appendChild(this.currentClone);

    // 3:4 crop overlay on cover page in long mode — dim the top/bottom strips that get cropped in feed
    this.coverCropOverlay = null;
    if (this.currentPage === 0 && this.effectivePageMode === "long") {
      const topStrip = document.createElement("div");
      topStrip.style.cssText = `position: absolute; left: 0; top: 0; width: 100%; background: rgba(255,60,60,0.15); border-bottom: 2px dashed rgba(255,60,60,0.6); pointer-events: none; z-index: 100;`;

      const bottomStrip = document.createElement("div");
      bottomStrip.style.cssText = `position: absolute; left: 0; width: 100%; background: rgba(255,60,60,0.15); border-top: 2px dashed rgba(255,60,60,0.6); pointer-events: none; z-index: 100;`;

      this.currentWrapper.appendChild(topStrip);
      this.currentWrapper.appendChild(bottomStrip);

      const ref = document.createElement("div");
      (ref as any)._topStrip = topStrip;
      (ref as any)._bottomStrip = bottomStrip;
      this.coverCropOverlay = ref;
    }

    this.rescale();

    this.refs.pageIndicator.textContent = `${this.currentPage + 1} / ${this.pages.length}`;

    // Show/hide sections based on current page
    this.refs.coverSection.style.display = this.currentPage === 0 ? "" : "none";
    this.refs.bodySection.style.display = this.currentPage === 0 ? "none" : "";
  }

  /** Rescale the current page clone to fit the container width */
  private rescale(): void {
    if (!this.currentClone || !this.currentWrapper || !this.refs) return;

    const pageHeight = PAGE_HEIGHTS[this.effectivePageMode];
    const areaWidth = Math.min(this.refs.previewContainer.clientWidth, 460);
    const scale = (areaWidth - 24) / PAGE_WIDTH;
    this.currentClone.style.transform = `scale(${scale})`;
    this.currentWrapper.style.width = `${PAGE_WIDTH * scale}px`;
    this.currentWrapper.style.height = `${pageHeight * scale}px`;

    if (this.coverCropOverlay) {
      const cropH = PAGE_HEIGHTS["card"];
      const stripH = (pageHeight - cropH) / 2;
      const scaledStripH = stripH * scale;
      const scaledPageH = pageHeight * scale;
      const topStrip = (this.coverCropOverlay as any)._topStrip as HTMLElement;
      const bottomStrip = (this.coverCropOverlay as any)._bottomStrip as HTMLElement;
      if (topStrip) topStrip.style.height = `${scaledStripH}px`;
      if (bottomStrip) {
        bottomStrip.style.top = `${scaledPageH - scaledStripH}px`;
        bottomStrip.style.height = `${scaledStripH}px`;
      }
    }
  }

  private showEmpty(msg: string): void {
    if (!this.refs) return;
    this.refs.pageDisplay.empty();
    this.currentClone = null;
    this.currentWrapper = null;
    this.refs.pageDisplay.createDiv({ cls: "nr-empty", text: msg });
    this.refs.pageIndicator.textContent = "";
  }

  goPage(delta: number): void {
    const next = this.currentPage + delta;
    if (next >= 0 && next < this.pages.length) {
      this.currentPage = next;
      this.showPage();
    }
  }

  async handleExportCurrentPage(): Promise<void> {
    if (this.pages.length === 0 || !this.pages[this.currentPage]) {
      new Notice("Nothing to export");
      return;
    }

    const file = this.app.workspace.getActiveFile();
    const baseName = file ? file.basename : "note";
    const pageNum = String(this.currentPage + 1).padStart(2, "0");
    const pngName = `${baseName}_${pageNum}`;

    new Notice("Exporting page...");
    try {
      const blob = await exportSinglePage(this.pages[this.currentPage], pngName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pngName}.png`;
      a.click();
      URL.revokeObjectURL(url);
      new Notice(`Exported page ${this.currentPage + 1}`);
    } catch (e) {
      console.error("Export failed:", e);
      new Notice("Export failed — check console");
    }
  }

  async handleExport(): Promise<void> {
    if (this.pages.length === 0) {
      new Notice("Nothing to export");
      return;
    }

    const file = this.app.workspace.getActiveFile();
    const baseName = file ? file.basename : "note";
    const theme = this.plugin.settings.activeTheme;
    const mode = this.plugin.settings.pageMode === "card" ? "3-4" : "3-5";
    const zipName = `${baseName}_${theme}_${mode}`;

    new Notice("Exporting...");
    try {
      const zipBlob = await exportPages(this.pages, baseName);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${zipName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      new Notice(`Exported ${this.pages.length} pages`);
    } catch (e) {
      console.error("Export failed:", e);
      new Notice("Export failed — check console");
    }
  }
}
