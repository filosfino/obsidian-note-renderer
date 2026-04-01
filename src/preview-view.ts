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
import { deriveCoverStrokePalette, extractCoverTitleColor } from "./effects";
import { EFFECT_SCHEMAS, RENDER_DEFAULTS, isCoverSemanticFieldActive } from "./schema";
import {
  readNoteConfig,
  resolveMergedRenderConfig,
  updateNoteConfigKey,
  saveFullNoteConfig,
  removeNoteConfig,
  extractRenderOptions,
} from "./config-manager";
import type NoteRendererPlugin from "./main";
import { PRESET_KEYS } from "./main";
import type { RendererConfig } from "./main";
import { buildSettingsPanel, setSelectValue as setFontSelectValue, type PanelHost, type PanelRefs } from "./settings-panel";

interface NoteSession {
  filePath: string;
  markdown: string;
  hasNoteConfig: boolean;
  shouldResetWorkingConfig: boolean;
  effectiveSettings: RendererConfig;
  renderOptions: ReturnType<typeof extractRenderOptions>;
}

type PresetValues = Partial<RendererConfig>;

function parseColorValue(color: string, fallback = "#000000"): string {
  if (!color) return fallback;
  if (color.startsWith("#")) return color;
  const parts = color.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return fallback;
  return "#" + [0, 1, 2]
    .map((index) => Math.round(Number(parts[index])).toString(16).padStart(2, "0"))
    .join("");
}

function parseAlphaPercent(color: string, fallback = 100): string {
  const parts = color.match(/[\d.]+/g);
  if (!parts || parts.length < 4) return String(fallback);
  return String(Math.round(parseFloat(parts[3]) * 100));
}

export class PreviewView extends ItemView implements PanelHost {
  plugin: NoteRendererPlugin;
  private pages: HTMLElement[] = [];
  private currentPage = 0;
  private rendered: RenderedPages | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private fileChangeHandler: ((file: TAbstractFile) => void) | null = null;
  private activeFileHandler: (...args: unknown[]) => void = () => {};

  // Current displayed clone + wrapper (for rescaling without re-rendering)
  private currentClone: HTMLElement | null = null;
  private currentWrapper: HTMLElement | null = null;
  private coverCropOverlay: { topStrip: HTMLElement; bottomStrip: HTMLElement } | null = null;
  private effectivePageMode: "long" | "card" = "long";
  private currentFilePath: string | null = null;

  // Guard: true while syncing UI from renderer_config, prevents change handlers from writing back during refresh
  syncing = false;

  // Note-first mode: UI parameter changes write to the active note's renderer_config when a markdown note is open
  editingNoteConfig = false;
  // The effective settings (note config or fallback plugin defaults) — UI handlers read from this
  effective: RendererConfig = {
    ...RENDER_DEFAULTS,
    coverEffects: { ...RENDER_DEFAULTS.coverEffects },
  } as RendererConfig;
  // Guard: true while writing note config, prevents file-change watcher from triggering refresh
  private writingNoteConfig = false;
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
    return "Note renderer";
  }

  getIcon(): string {
    return "image";
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    this.refs = buildSettingsPanel(this, contentEl);

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
    this.activeFileHandler = () => { debouncedRefresh(); };
    this.app.workspace.on("active-leaf-change", this.activeFileHandler );

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
      this.app.workspace.off("active-leaf-change", this.activeFileHandler);
    }
  }

  async refresh(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      this.showEmpty("Open a markdown file to preview");
      return;
    }

    const session = await this.buildNoteSession(file.path, file.extension);
    if (session.shouldResetWorkingConfig) {
      this.resetWorkingConfigToDefault();
      this.plugin.clearActivePreset();
      await this.plugin.saveSettings();
    }
    this.applyNoteSession(session);

    // Sync UI controls to reflect the effective (possibly overridden) settings
    this.syncUiToSettings(session.effectiveSettings);

    this.effectivePageMode = session.effectiveSettings.pageMode as "long" | "card";
    const themeCss = await this.plugin.loadTheme(session.effectiveSettings.activeTheme);

    this.rendered?.cleanup();
    this.rendered = await renderNote(
      this.app,
      session.markdown,
      file.path,
      themeCss,
      session.effectiveSettings.activeTheme,
      this.plugin,
      session.renderOptions,
    );

    this.pages = this.rendered.pages;
    // Hide overlay chip + params when no cover image
    if (this.refs) {
      const show = this.rendered.hasCoverImage;
      this.refs.overlayToggle.classList.toggle("nr-hidden", !show);
      if (this.refs.effectParamRows["overlay"]) {
        this.refs.effectParamRows["overlay"].classList.toggle("nr-hidden", !(show && this.effective.coverEffects?.overlay?.enabled));
      }
    }
    // Preserve current page if possible, otherwise reset to 0
    if (this.currentPage >= this.pages.length) {
      this.currentPage = 0;
    }
    this.showPage();
  }

  private async buildNoteSession(filePath: string, extension: string): Promise<NoteSession> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.path !== filePath || file.extension !== extension) {
      throw new Error("Active file changed during refresh");
    }

    const markdown = await this.app.vault.read(file);
    const noteConfig = readNoteConfig(markdown);
    const resolved = resolveMergedRenderConfig(this.plugin.getFallbackRenderConfig(), noteConfig);

    return {
      filePath,
      markdown,
      hasNoteConfig: !!noteConfig,
      shouldResetWorkingConfig: filePath !== this.currentFilePath && !noteConfig,
      effectiveSettings: resolved.settings,
      renderOptions: resolved.options,
    };
  }

  private applyNoteSession(session: NoteSession): void {
    this.currentFilePath = session.filePath;
    this.hasNoteConfig = session.hasNoteConfig;
    this.effective = session.effectiveSettings;
    this.editingNoteConfig = session.hasNoteConfig;
    this.updateNoteActionButtons(session.hasNoteConfig);
  }

  private updateNoteActionButtons(hasNoteConfig: boolean): void {
    if (!this.refs) return;
    this.refs.saveToNoteBtn.classList.toggle("nr-hidden", hasNoteConfig);
    this.refs.removeFromNoteBtn.classList.toggle("nr-hidden", !hasNoteConfig);
  }

  private resetWorkingConfigToDefault(): void {
    const defaultPreset = this.plugin.getPresetValues("default");
    for (const key of PRESET_KEYS) {
      this.plugin.setFallbackRenderValue(key, this.getPresetValueOrDefault(defaultPreset, key));
    }
  }

  /**
   * Route a setting change to global or note config depending on editing mode.
   * All UI handlers should call this instead of directly mutating fallback/plugin state.
   */
  async updateSetting<K extends keyof RendererConfig>(
    key: K, value: RendererConfig[K]
  ): Promise<void> {
    if (this.editingNoteConfig) {
      await this.updateNoteConfig(key as string, value);
    } else {
      this.plugin.setFallbackRenderValue(key, value);
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
    const hasNoteConfig = !!readNoteConfig(markdown);
    const updated = hasNoteConfig
      ? updateNoteConfigKey(markdown, key, value)
      : (() => {
          const nextSettings: RendererConfig = {
            ...this.effective,
            [key]: value,
          };
          const nextOptions = extractRenderOptions(nextSettings);
          return saveFullNoteConfig(markdown, nextOptions);
        })();
    if (updated === markdown) return;

    this.writingNoteConfig = true;
    await this.app.vault.modify(file, updated);
    setTimeout(() => { this.writingNoteConfig = false; }, 100);
  }

  async applyPreset(name: string): Promise<void> {
    const preset = this.plugin.getPresetValues(name);
    if (!preset) return;

    for (const key of PRESET_KEYS) {
      this.plugin.setFallbackRenderValue(key, this.getPresetValueOrDefault(preset, key));
    }

    this.plugin.setActivePresetName(name);
    await this.plugin.saveSettings();
  }

  /** Rebuild preset dropdown options from current settings. */
  rebuildPresetOptions(): void {
    if (!this.refs) return;
    const sel = this.refs.presetSelect;
    sel.empty();
    sel.createEl("option", { text: "(无预设)", value: "" });
    for (const name of this.plugin.getPresetNames()) {
      sel.createEl("option", { text: this.plugin.getPresetDisplayName(name), value: name });
    }
    sel.value = this.getActivePresetName();
  }

  private getActivePresetName(): string {
    return this.plugin.getActivePresetName();
  }

  private getPresetValues(name: string): PresetValues | undefined {
    return this.plugin.getPresetValues(name);
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

  /**
   * Check if the current working settings differ from the active preset.
   * In note-first mode, compare against note/effective settings when a note config exists;
   * otherwise compare against global fallback settings.
   */
  private isPresetModified(s: RendererConfig): boolean {
    const presetName = this.getActivePresetName();
    if (!presetName) return false;
    const preset = this.getPresetValues(presetName);
    if (!preset) return false;
    const fallbackSettings = this.plugin.getFallbackRenderConfig();
    const currentSettings = this.hasNoteConfig ? s : fallbackSettings;
    for (const key of PRESET_KEYS) {
      const expectedVal = this.getPresetValueOrDefault(preset, key);
      const currentVal = currentSettings[key];
      if (JSON.stringify(expectedVal) !== JSON.stringify(currentVal)) {
        return true;
      }
    }
    return false;
  }

  /** Sync UI control display values to reflect effective settings (e.g. after renderer_config override). */
  private syncUiToSettings(s: RendererConfig): void {
    if (!this.refs) return;
    this.syncing = true;
    this.syncPresetUi(s);
    this.syncBaseControls(s);
    this.syncCoverStylingControls(s);
    this.syncThemeDerivedColors(s);
    this.syncing = false;
  }

  private syncPresetUi(s: RendererConfig): void {
    if (!this.refs) return;
    const presetName = this.getActivePresetName();
    const baseLabel = presetName ? this.plugin.getPresetDisplayName(presetName) : "";
    const isModified = presetName ? this.isPresetModified(s) : false;
    const presetLocked = presetName ? this.plugin.isPresetLocked(presetName) : false;
    const selectedOpt = presetName
      ? this.refs.presetSelect.querySelector<HTMLOptionElement>(`option[value="${CSS.escape(presetName)}"]`)
      : null;

    this.refs.presetSelect.value = presetName;
    this.refs.presetLockBtn.textContent = presetLocked ? "🔒" : "🔓";
    this.refs.presetLockBtn.title = presetName ? (presetLocked ? `解锁预设「${presetName}」` : `锁定预设「${presetName}」`) : "先选择一个预设";
    this.refs.presetLockBtn.disabled = !presetName;
    this.refs.presetLockBtn.classList.toggle("is-disabled", !presetName);

    if (selectedOpt) {
      selectedOpt.text = isModified ? `${baseLabel} (modified)` : baseLabel;
    }
  }

  private syncBaseControls(s: RendererConfig): void {
    if (!this.refs) return;
    const r = this.refs;

    r.themeSelect.value = s.activeTheme;
    r.modeSelect.value = s.pageMode;
    r.modeBtns.long.classList.toggle("nr-btn-active", s.pageMode === "long");
    r.modeBtns.card.classList.toggle("nr-btn-active", s.pageMode === "card");
    r.sizeInput.value = String(s.fontSize);
    r.listStyleBtns.default.classList.toggle("nr-btn-active", s.listStyle !== "capsule");
    r.listStyleBtns.capsule.classList.toggle("nr-btn-active", s.listStyle === "capsule");
    setFontSelectValue(r.fontSelect, s.fontFamily);
    setFontSelectValue(r.coverFontSelect, s.coverFontFamily);
  }

  private syncCoverStylingControls(s: RendererConfig): void {
    if (!this.refs) return;
    const r = this.refs;
    const strokeOn = s.coverStrokeStyle !== "none";
    const align = s.coverTextAlign ?? "left";

    r.scaleInput.value = String(s.coverFontScale);
    r.coverOpacityInput.value = String(s.coverFontOpacity ?? 100);
    r.lsInput.value = String(s.coverLetterSpacing);
    r.lhInput.value = String(s.coverLineHeight);
    r.strokeStyleSelect.value = s.coverStrokeStyle;
    r.strokeInput.value = String(s.coverStrokePercent);
    r.opInput.value = String(s.coverStrokeOpacity);
    r.doubleStrokeInput.value = String(s.coverDoubleStrokePercent);
    r.glowToggle.classList.toggle("active", s.coverGlow);
    r.glowInput.value = String(s.coverGlowSize);
    r.strokeColorInput.value = parseColorValue(s.coverStrokeColor, "#000000");
    r.doubleStrokeColorInput.value = parseColorValue(s.coverDoubleStrokeColor, s.coverFontColor || "#e07c5a");
    r.strokeAlphaInput.value = String(s.coverStrokeOpacity);
    r.glowColorInput.value = parseColorValue(s.coverGlowColor, s.coverFontColor || "#e07c5a");
    r.overlayToggle.classList.toggle("active", s.coverEffects?.overlay?.enabled ?? false);
    r.oxInput.value = String(s.coverOffsetX);
    r.oyInput.value = String(s.coverOffsetY);
    r.coverPaddingInput.value = String(s.coverPagePaddingX ?? 90);
    r.shadowToggle.classList.toggle("active", s.coverShadow);
    r.blurInput.value = String(s.coverShadowBlur);
    r.shadowColorInput.value = parseColorValue(s.coverShadowColor, "#000000");
    r.shadowAlphaInput.value = parseAlphaPercent(s.coverShadowColor, 60);
    r.bannerToggle.classList.toggle("active", s.coverBanner);
    r.strokeToggle.classList.toggle("active", strokeOn);
    r.strokeParamsRow.classList.toggle("nr-hidden", !strokeOn);
    r.doubleStrokeField.classList.toggle("nr-hidden", !isCoverSemanticFieldActive("stroke", "outerWidth", s));
    r.doubleStrokeColorField.classList.toggle("nr-hidden", !isCoverSemanticFieldActive("stroke", "outerColor", s));
    r.glowParamsRow.classList.toggle("nr-hidden", !s.coverGlow);
    r.bannerParamsRow.classList.toggle("nr-hidden", !s.coverBanner);
    r.shadowParamsRow.classList.toggle("nr-hidden", !s.coverShadow);
    r.alignBtns.left.classList.toggle("nr-btn-active", align === "left");
    r.alignBtns.center.classList.toggle("nr-btn-active", align === "center");
    r.alignBtns.right.classList.toggle("nr-btn-active", align === "right");

    this.syncEffectControls(s);
  }

  private syncEffectControls(s: RendererConfig): void {
    if (!this.refs) return;

    for (const [name, chip] of Object.entries(this.refs.effectChips)) {
      const params = s.coverEffects?.[name];
      const enabled = params?.enabled ?? false;
      chip.classList.toggle("active", enabled);
      const row = this.refs.effectParamRows[name];
      if (!row) continue;

      row.classList.toggle("nr-hidden", !enabled);
      const inputs = row.querySelectorAll<HTMLInputElement>(".nr-field-input");
      if (inputs[0] && params?.opacity != null) inputs[0].value = String(params.opacity);

      let inputIndex = 1;
      const meta = EFFECT_SCHEMAS[name];
      if (meta?.defaultCount != null && inputs[inputIndex]) {
        inputs[inputIndex].value = String(params?.count ?? meta.defaultCount);
        inputIndex += 1;
      }
      if (meta?.defaultWidth != null && inputs[inputIndex]) {
        inputs[inputIndex].value = String(params?.width ?? meta.defaultWidth);
        inputIndex += 1;
      }
      if (meta?.defaultSpacing != null && inputs[inputIndex]) {
        inputs[inputIndex].value = String(params?.spacing ?? meta.defaultSpacing);
        inputIndex += 1;
      }
      if (meta?.defaultSize != null && inputs[inputIndex]) {
        inputs[inputIndex].value = String(params?.size ?? meta.defaultSize);
      }

      const colorInput = row.querySelector<HTMLInputElement>(".nr-color-dot");
      if (colorInput && meta?.defaultColor != null && params?.color) {
        colorInput.value = parseColorValue(params.color, colorInput.value || "#000000");
      }
    }
  }

  private syncThemeDerivedColors(s: RendererConfig): void {
    if (!this.refs) return;

    void this.plugin.loadTheme(s.activeTheme).then((css) => {
      if (!this.refs) return;
      const themeColor = extractCoverTitleColor(css, s.activeTheme) || "#e07c5a";
      const strokePalette = deriveCoverStrokePalette(css, s.activeTheme);
      this.refs.coverColorInput.value = s.coverFontColor || themeColor;
      this.refs.strokeColorInput.value = parseColorValue(s.coverStrokeColor, strokePalette.inner);
      this.refs.doubleStrokeColorInput.value = parseColorValue(s.coverDoubleStrokeColor, strokePalette.outer);
      this.refs.glowColorInput.value = parseColorValue(s.coverGlowColor, s.coverFontColor || themeColor);
    });
  }

  /** Save current UI settings as renderer_config into the active note. */
  async handleSaveToNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("No active Markdown file");
      return;
    }
    const markdown = await this.app.vault.read(file);
    const options = extractRenderOptions(this.effective);

    const updated = saveFullNoteConfig(markdown, options);
    await this.app.vault.modify(file, updated);
    new Notice("已存入笔记");
  }

  /** Remove renderer_config section from the active note. */
  async handleRemoveFromNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("No active Markdown file");
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

    this.currentClone = page.cloneNode(true) as HTMLElement;
    this.currentClone.classList.add("nr-page-clone");
    this.currentWrapper.appendChild(this.currentClone);

    // 3:4 crop overlay on cover page in long mode — dim the top/bottom strips that get cropped in feed
    this.coverCropOverlay = null;
    if (this.currentPage === 0 && this.effectivePageMode === "long") {
      const topStrip = document.createElement("div");
      topStrip.classList.add("nr-crop-strip", "nr-crop-strip-top");

      const bottomStrip = document.createElement("div");
      bottomStrip.classList.add("nr-crop-strip", "nr-crop-strip-bottom");

      this.currentWrapper.appendChild(topStrip);
      this.currentWrapper.appendChild(bottomStrip);

      this.coverCropOverlay = { topStrip, bottomStrip };
    }

    this.rescale();

    this.refs.pageIndicator.textContent = `${this.currentPage + 1} / ${this.pages.length}`;

    // Show/hide sections based on current page
    this.refs.coverSection.classList.toggle("nr-hidden", this.currentPage !== 0);
    this.refs.bodySection.classList.toggle("nr-hidden", this.currentPage === 0);
  }

  /** Rescale the current page clone to fit the container width */
  private rescale(): void {
    if (!this.currentClone || !this.currentWrapper || !this.refs) return;

    const pageHeight = PAGE_HEIGHTS[this.effectivePageMode];
    const areaWidth = Math.min(this.refs.previewContainer.clientWidth, 460);
    const scale = (areaWidth - 24) / PAGE_WIDTH;
    this.currentClone.setCssStyles({ transform: `scale(${scale})` });
    this.currentWrapper.setCssStyles({ width: `${PAGE_WIDTH * scale}px`, height: `${pageHeight * scale}px` });

    if (this.coverCropOverlay) {
      const cropH = PAGE_HEIGHTS["card"];
      const stripH = (pageHeight - cropH) / 2;
      const scaledStripH = stripH * scale;
      const scaledPageH = pageHeight * scale;
      this.coverCropOverlay.topStrip.setCssStyles({ height: `${scaledStripH}px` });
      this.coverCropOverlay.bottomStrip.setCssStyles({ top: `${scaledPageH - scaledStripH}px`, height: `${scaledStripH}px` });
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

    await this.runExport(
      "Exporting page...",
      () => exportSinglePage(this.pages[this.currentPage], pngName),
      `${pngName}.png`,
      `Exported page ${this.currentPage + 1}`,
    );
  }

  async handleExport(): Promise<void> {
    if (this.pages.length === 0) {
      new Notice("Nothing to export");
      return;
    }

    const file = this.app.workspace.getActiveFile();
    const baseName = file ? file.basename : "note";
    const theme = this.effective.activeTheme;
    const mode = this.effectivePageMode === "card" ? "3-4" : "3-5";
    const zipName = `${baseName}_${theme}_${mode}`;

    await this.runExport(
      "Exporting...",
      () => exportPages(this.pages, baseName),
      `${zipName}.zip`,
      `Exported ${this.pages.length} pages`,
    );
  }

  private async runExport(
    loadingNotice: string,
    exportFn: () => Promise<Blob>,
    downloadName: string,
    successNotice: string,
  ): Promise<void> {
    new Notice(loadingNotice);
    try {
      const blob = await exportFn();
      this.downloadBlob(blob, downloadName);
      new Notice(successNotice);
    } catch (e) {
      console.error("Export failed:", e);
      new Notice("Export failed — check console");
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
