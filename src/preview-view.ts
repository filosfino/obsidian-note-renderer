import {
  ItemView,
  WorkspaceLeaf,
  TAbstractFile,
  Notice,
  debounce,
} from "obsidian";
import { VIEW_TYPE, PAGE_HEIGHTS, getPageWidth } from "./constants";
import { renderNote, RenderedPages } from "./renderer";
import { exportPages, exportSinglePage } from "./exporter";
import { deriveCoverStrokePalette, extractCoverTitleColor } from "./effects";
import { BODY_EFFECT_NAMES, EFFECT_SCHEMAS, RENDER_DEFAULTS, getDefaultCoverPaddingX, isCoverSemanticFieldActive } from "./schema";
import {
  readNoteConfig,
  readNoteConfigMetadata,
  resolveMergedRenderConfig,
  saveFullNoteConfig,
  savePresetReferenceToNote,
  removeNoteConfig,
  extractRenderOptions,
} from "./config-manager";
import type NoteRendererPlugin from "./main";
import { PRESET_KEYS, createDefaultRendererConfig, type RendererConfig } from "./plugin-types";
import { buildSettingsPanel, setSelectValue as setFontSelectValue, type PanelHost, type PanelRefs } from "./settings-panel";
import { getModeAwareRenderDefaults } from "./schema";

interface NoteSession {
  filePath: string;
  markdown: string;
  hasNoteConfig: boolean;
  shouldResetWorkingConfig: boolean;
  effectiveSettings: RendererConfig;
  renderOptions: ReturnType<typeof extractRenderOptions>;
}

type PresetValues = Partial<RendererConfig>;

function normalizeHexColor(color: string): string {
  if (!color.startsWith("#")) return color;
  const hex = color.slice(1).trim();
  if (hex.length === 3) {
    return `#${hex.split("").map((ch) => ch + ch).join("")}`;
  }
  return color;
}

function parseColorValue(color: string, fallback = "#000000"): string {
  if (!color) return normalizeHexColor(fallback);
  if (color.startsWith("#")) return normalizeHexColor(color);
  const parts = color.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return normalizeHexColor(fallback);
  return "#" + [0, 1, 2]
    .map((index) => Math.round(Number(parts[index])).toString(16).padStart(2, "0"))
    .join("");
}

function parseAlphaPercent(color: string, fallback = 100): string {
  const parts = color.match(/[\d.]+/g);
  if (!parts || parts.length < 4) return String(fallback);
  return String(Math.round(parseFloat(parts[3]) * 100));
}

function findOptionByValue(select: HTMLSelectElement, value: string): HTMLOptionElement | null {
  for (const option of Array.from(select.options)) {
    if (option.value === value) return option;
  }
  return null;
}

export class PreviewView extends ItemView implements PanelHost {
  plugin: NoteRendererPlugin;
  private pages: HTMLElement[] = [];
  private currentPage = 0;
  private rendered: RenderedPages | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private fileChangeHandler: ((file: TAbstractFile) => void) | null = null;
  private activeFileHandler: (...args: unknown[]) => void = () => {};
  private refreshToken = 0;

  // Current displayed clone + wrapper (for rescaling without re-rendering)
  private currentClone: HTMLElement | null = null;
  private currentWrapper: HTMLElement | null = null;
  private coverCropOverlay: { topStrip: HTMLElement; bottomStrip: HTMLElement } | null = null;
  private effectivePageMode: "long" | "card" = "long";
  private currentFilePath: string | null = null;

  // Guard: true while syncing UI from effective settings, prevents change handlers from looping.
  syncing = false;
  private hasNoteConfig = false;

  // The effective settings (note config or fallback plugin defaults) — UI handlers read from this
  effective: RendererConfig = {
    ...RENDER_DEFAULTS,
    coverEffects: { ...RENDER_DEFAULTS.coverEffects },
    bodyEffects: { ...RENDER_DEFAULTS.bodyEffects },
  } as RendererConfig;
  private baselineSettings: RendererConfig = createDefaultRendererConfig();
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
    const debouncedRefresh = debounce(() => this.refresh(), 250, false);

    this.fileChangeHandler = (file: TAbstractFile) => {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && file.path === activeFile.path) {
        debouncedRefresh();
      }
    };
    this.app.vault.on("modify", this.fileChangeHandler);

    // Watch for active file change — switch immediately, don't reuse a debounced call
    this.activeFileHandler = () => { void this.refresh(); };
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
    const refreshToken = ++this.refreshToken;
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      this.showEmpty("Open a markdown file to preview");
      return;
    }

    if (file.path !== this.currentFilePath) {
      this.showEmpty("Loading preview...");
    }

    const session = await this.buildNoteSession(file.path, file.extension);
    if (!this.isRefreshStillCurrent(refreshToken, session.filePath)) {
      return;
    }
    if (session.shouldResetWorkingConfig) {
      this.loadWorkingConfig(session.effectiveSettings);
    }
    this.applyNoteSession(session);

    // Sync UI controls to reflect the effective (possibly overridden) settings
    this.syncUiToSettings(session.effectiveSettings);

    this.effectivePageMode = session.effectiveSettings.pageMode as "long" | "card";
    const themeCss = await this.plugin.loadTheme(session.effectiveSettings.activeTheme);
    if (!this.isRefreshStillCurrent(refreshToken, session.filePath)) {
      return;
    }

    this.rendered?.cleanup();
    const rendered = await renderNote(
      this.app,
      session.markdown,
      session.filePath,
      themeCss,
      session.effectiveSettings.activeTheme,
      this.plugin,
      session.renderOptions,
    );
    if (!this.isRefreshStillCurrent(refreshToken, session.filePath)) {
      rendered.cleanup();
      return;
    }
    this.rendered = rendered;

    this.pages = this.rendered.pages;
    // Hide overlay chip + params when no cover image
    if (this.refs) {
      const show = this.rendered.hasCoverImage;
      this.refs.overlayToggle.classList.toggle("nr-hidden", !show);
      if (this.refs.coverEffectParamRows["overlay"]) {
        this.refs.coverEffectParamRows["overlay"].classList.toggle("nr-hidden", !(show && this.effective.coverEffects?.overlay?.enabled));
      }
    }
    // Preserve current page if possible, otherwise reset to 0
    if (this.currentPage >= this.pages.length) {
      this.currentPage = 0;
    }
    this.showPage();
  }

  private isRefreshStillCurrent(refreshToken: number, filePath: string): boolean {
    const activeFile = this.app.workspace.getActiveFile();
    return this.refreshToken === refreshToken
      && !!activeFile
      && activeFile.extension === "md"
      && activeFile.path === filePath;
  }

  private async buildNoteSession(filePath: string, extension: string): Promise<NoteSession> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.path !== filePath || file.extension !== extension) {
      throw new Error("Active file changed during refresh");
    }

    const markdown = await this.app.vault.read(file);
    const noteConfig = readNoteConfig(markdown);
    const noteMeta = readNoteConfigMetadata(markdown);
    const switchedFile = filePath !== this.currentFilePath;
    const activePreset = noteMeta.activePreset && this.plugin.getPresetValues(noteMeta.activePreset)
      ? noteMeta.activePreset
      : "";
    const hasNoteConfig = !!noteConfig || !!activePreset;

    if (switchedFile) {
      const baseSettings = activePreset
        ? this.buildSettingsFromPreset(activePreset) ?? createDefaultRendererConfig()
        : createDefaultRendererConfig();
      const resolved = resolveMergedRenderConfig(baseSettings, noteConfig);
      this.resetWorkingConfigToDefault();
      this.plugin.setActivePresetName(activePreset);
      return {
        filePath,
        markdown,
        hasNoteConfig,
        shouldResetWorkingConfig: true,
        effectiveSettings: resolved.settings,
        renderOptions: resolved.options,
      };
    }

    const effectiveSettings = this.plugin.getFallbackRenderConfig();

    return {
      filePath,
      markdown,
      hasNoteConfig,
      shouldResetWorkingConfig: false,
      effectiveSettings,
      renderOptions: extractRenderOptions(effectiveSettings),
    };
  }

  private applyNoteSession(session: NoteSession): void {
    this.currentFilePath = session.filePath;
    this.hasNoteConfig = session.hasNoteConfig;
    this.effective = session.effectiveSettings;
    if (session.shouldResetWorkingConfig) {
      this.baselineSettings = this.cloneSettings(session.effectiveSettings);
    }
    this.updateNoteActionButtons(session.hasNoteConfig);
  }

  private updateNoteActionButtons(hasNoteConfig: boolean): void {
    if (!this.refs) return;
    this.refs.saveToNoteBtn.classList.remove("nr-hidden");
    this.refs.removeFromNoteBtn.classList.toggle("nr-hidden", !hasNoteConfig);
  }

  private resetWorkingConfigToDefault(): void {
    const defaultPreset = this.plugin.getPresetValues("default");
    for (const key of PRESET_KEYS) {
      this.plugin.setFallbackRenderValue(key, this.getPresetValueOrDefault(defaultPreset, key));
    }
  }

  private loadWorkingConfig(settings: RendererConfig): void {
    for (const key of PRESET_KEYS) {
      this.plugin.setFallbackRenderValue(key, settings[key]);
    }
  }

  /**
   * Route a setting change to global or note config depending on editing mode.
   * All UI handlers should call this instead of directly mutating fallback/plugin state.
   */
  async updateSetting<K extends keyof RendererConfig>(
    key: K, value: RendererConfig[K]
  ): Promise<void> {
    if (key === "pageMode") {
      const nextMode = value as RendererConfig["pageMode"];
      const adjusted = this.applyModeDefaultsForPageModeSwitch(this.effective, nextMode);
      for (const presetKey of PRESET_KEYS) {
        this.plugin.setFallbackRenderValue(presetKey, adjusted[presetKey]);
      }
      await this.refresh();
      return;
    }

    this.plugin.setFallbackRenderValue(key, value);
    if (key === "coverEffects") {
      const coverEffects = value as RendererConfig["coverEffects"];
      const nextBodyEffects: RendererConfig["bodyEffects"] = {
        ...this.effective.bodyEffects,
      };
      for (const effectName of BODY_EFFECT_NAMES) {
        const source = coverEffects[effectName];
        const currentBody = nextBodyEffects[effectName];
        if (!source || !currentBody) continue;
        nextBodyEffects[effectName] = {
          ...currentBody,
          opacity: source.opacity,
          mode: source.mode,
          shape: source.shape,
          count: source.count,
          width: source.width,
          spacing: source.spacing,
          size: source.size,
          color: source.color,
        };
      }
      this.plugin.setFallbackRenderValue("bodyEffects", nextBodyEffects);
    } else if (key === "bodyEffects") {
      const bodyEffects = value as RendererConfig["bodyEffects"];
      const nextCoverEffects: RendererConfig["coverEffects"] = {
        ...this.effective.coverEffects,
      };
      for (const effectName of BODY_EFFECT_NAMES) {
        const source = bodyEffects[effectName];
        const currentCover = nextCoverEffects[effectName];
        if (!source || !currentCover) continue;
        nextCoverEffects[effectName] = {
          ...currentCover,
          opacity: source.opacity,
          mode: source.mode,
          shape: source.shape,
          count: source.count,
          width: source.width,
          spacing: source.spacing,
          size: source.size,
          color: source.color,
        };
      }
      this.plugin.setFallbackRenderValue("coverEffects", nextCoverEffects);
    }
    await this.refresh();
  }

  private applyModeDefaultsForPageModeSwitch(
    current: RendererConfig,
    nextMode: RendererConfig["pageMode"],
  ): RendererConfig {
    const prevMode = current.pageMode === "long" ? "long" : "card";
    const nextModeKey = nextMode === "long" ? "long" : "card";
    const prevDefaults = getModeAwareRenderDefaults(prevMode);
    const nextDefaults = getModeAwareRenderDefaults(nextModeKey);
    const nextSettings = this.cloneSettings(current);
    const nextSettingsMutable = nextSettings as Record<string, unknown>;
    nextSettingsMutable.pageMode = nextMode;

    const modeSensitiveKeys: Array<keyof RendererConfig> = [
      "coverPagePaddingX",
      "coverGlowSize",
      "coverShadowBlur",
      "coverShadowOffsetX",
      "coverShadowOffsetY",
    ];

    for (const modeKey of modeSensitiveKeys) {
      if (current[modeKey] === prevDefaults[modeKey]) {
        nextSettingsMutable[modeKey] = nextDefaults[modeKey];
      }
    }

    const coverEffects = this.cloneEffectsMap(current.coverEffects);
    const prevCover = prevDefaults.coverEffects;
    const nextCover = nextDefaults.coverEffects;
    for (const effectName of ["dots", "grid", "network"]) {
      const currentEffect = coverEffects[effectName];
      const prevEffect = prevCover[effectName];
      const nextEffect = nextCover[effectName];
      if (!currentEffect || !prevEffect || !nextEffect) continue;
      if (currentEffect.spacing === prevEffect.spacing && nextEffect.spacing !== undefined) currentEffect.spacing = nextEffect.spacing;
      if (currentEffect.size === prevEffect.size && nextEffect.size !== undefined) currentEffect.size = nextEffect.size;
      if (currentEffect.width === prevEffect.width && nextEffect.width !== undefined) currentEffect.width = nextEffect.width;
    }
    nextSettingsMutable.coverEffects = coverEffects;

    const bodyEffects = this.cloneEffectsMap(current.bodyEffects);
    const prevBody = prevDefaults.bodyEffects;
    const nextBody = nextDefaults.bodyEffects;
    for (const effectName of ["dots", "grid"]) {
      const currentEffect = bodyEffects[effectName];
      const prevEffect = prevBody[effectName];
      const nextEffect = nextBody[effectName];
      if (!currentEffect || !prevEffect || !nextEffect) continue;
      if (currentEffect.spacing === prevEffect.spacing && nextEffect.spacing !== undefined) currentEffect.spacing = nextEffect.spacing;
      if (currentEffect.size === prevEffect.size && nextEffect.size !== undefined) currentEffect.size = nextEffect.size;
    }
    nextSettingsMutable.bodyEffects = bodyEffects;

    return nextSettings;
  }

  private cloneEffectsMap<T extends Record<string, { enabled: boolean; opacity: number }>>(effects: T): T {
    return Object.fromEntries(
      Object.entries(effects).map(([name, params]) => [name, { ...params }]),
    ) as T;
  }

  async applyPreset(name: string): Promise<void> {
    const preset = this.plugin.getPresetValues(name);
    if (!preset) return;

    const nextSettings = createDefaultRendererConfig() as RendererConfig;
    const nextSettingsMutable = nextSettings as Record<string, unknown>;
    for (const key of PRESET_KEYS) {
      nextSettingsMutable[key] = this.getPresetValueOrDefault(preset, key);
    }

    for (const key of PRESET_KEYS) {
      this.plugin.setFallbackRenderValue(key, nextSettings[key]);
    }
    this.plugin.setActivePresetName(name);
  }

  private buildSettingsFromPreset(name: string): RendererConfig | null {
    const preset = this.getPresetValues(name);
    if (!preset) return null;

    const settings = createDefaultRendererConfig() as RendererConfig;
    const mutable = settings as Record<string, unknown>;
    for (const key of PRESET_KEYS) {
      mutable[key] = this.getPresetValueOrDefault(preset, key);
    }
    return settings;
  }

  async clearPresetSelection(): Promise<void> {
    this.plugin.clearActivePreset();
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
    const currentSettings = s;
    for (const key of PRESET_KEYS) {
      const expectedVal = this.getPresetValueOrDefault(preset, key);
      const currentVal = currentSettings[key];
      if (JSON.stringify(expectedVal) !== JSON.stringify(currentVal)) {
        return true;
      }
    }
    return false;
  }

  /** Sync UI control display values to reflect effective settings. */
  private syncUiToSettings(s: RendererConfig): void {
    if (!this.refs) return;
    this.syncing = true;
    this.syncPresetUi(s);
    this.syncConfigSourceUi(s);
    this.syncBaseControls(s);
    this.syncCoverStylingControls(s);
    this.syncThemeDerivedColors(s);
    this.syncing = false;
  }

  private syncConfigSourceUi(s: RendererConfig): void {
    if (!this.refs) return;

    const badge = this.refs.configSourceBadge;
    const source = this.getConfigSourceState(s);
    badge.textContent = source.label;
    badge.title = source.title;
    badge.classList.remove("is-note");
    badge.classList.toggle("is-note", source.kind === "note");
    badge.classList.toggle("is-working", source.kind === "working");
  }

  private getConfigSourceState(s: RendererConfig): {
    kind: "note" | "working" | "default";
    label: string;
    title: string;
  } {
    const activePreset = this.getActivePresetName();
    const matchesBaseline = this.areSettingsEqual(s, this.baselineSettings);
    const matchesDefault = this.areSettingsEqual(s, createDefaultRendererConfig());

    if (this.hasNoteConfig && matchesBaseline) {
      return {
        kind: "note",
        label: "笔记配置",
        title: "当前使用笔记里的 renderer_config",
      };
    }

    if (activePreset) {
      return {
        kind: "working",
        label: "预设工作态",
        title: `当前是未保存的工作态，基于预设「${activePreset}」`,
      };
    }

    if (matchesDefault) {
      return {
        kind: "default",
        label: "默认值",
        title: "当前没有选中预设，预览使用默认值",
      };
    }

    return {
      kind: "working",
      label: "工作态",
      title: this.hasNoteConfig
        ? "当前是未保存的工作态，已偏离笔记配置"
        : "当前是未保存的工作态",
    };
  }

  private areSettingsEqual(a: RendererConfig, b: RendererConfig): boolean {
    for (const key of PRESET_KEYS) {
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
        return false;
      }
    }
    return true;
  }

  private cloneSettings(settings: RendererConfig): RendererConfig {
    return {
      ...settings,
      coverEffects: Object.fromEntries(
        Object.entries(settings.coverEffects).map(([name, params]) => [name, { ...params }]),
      ),
      bodyEffects: Object.fromEntries(
        Object.entries(settings.bodyEffects).map(([name, params]) => [name, { ...params }]),
      ),
    } as RendererConfig;
  }

  private syncPresetUi(s: RendererConfig): void {
    if (!this.refs) return;
    const presetName = this.getActivePresetName();
    const baseLabel = presetName ? this.plugin.getPresetDisplayName(presetName) : "";
    const isModified = presetName ? this.isPresetModified(s) : false;
    const presetLocked = presetName ? this.plugin.isPresetLocked(presetName) : false;
    const selectedOpt = presetName
      ? findOptionByValue(this.refs.presetSelect, presetName)
      : null;

    this.refs.presetSelect.value = presetName;
    this.refs.presetLockBtn.textContent = presetLocked ? "🔒" : "🔓";
    this.refs.presetLockBtn.title = presetName ? (presetLocked ? `解锁预设「${presetName}」` : `锁定预设「${presetName}」`) : "先选择一个预设";
    this.refs.presetLockBtn.disabled = !presetName;
    this.refs.presetLockBtn.classList.toggle("is-disabled", !presetName);

    for (const name of this.plugin.getPresetNames()) {
      const opt = findOptionByValue(this.refs.presetSelect, name);
      if (opt) {
        opt.text = this.plugin.getPresetDisplayName(name);
      }
    }

    if (selectedOpt) {
      selectedOpt.text = isModified ? `${baseLabel} (modified)` : this.plugin.getPresetDisplayName(presetName);
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
    const markStyle = s.coverMarkStyle ?? "marker";

    r.scaleInput.value = String(s.coverFontScale);
    r.coverOpacityInput.value = String(s.coverFontOpacity ?? 100);
    r.coverMarkStyleBtns.marker.classList.toggle("nr-btn-active", markStyle === "marker");
    r.coverMarkStyleBtns.block.classList.toggle("nr-btn-active", markStyle === "block");
    r.coverMarkStyleBtns.underline.classList.toggle("nr-btn-active", markStyle === "underline");
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
    const coverPaddingMode = s.pageMode === "long" ? "long" : "card";
    r.coverPaddingInput.value = String(s.coverPagePaddingX ?? getDefaultCoverPaddingX(coverPaddingMode));
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
    r.alignBtns.left.classList.toggle("active", align === "left");
    r.alignBtns.center.classList.toggle("active", align === "center");
    r.alignBtns.right.classList.toggle("active", align === "right");

    this.syncEffectControls(s, "cover");
    this.syncEffectControls(s, "body");
  }

  private syncEffectControls(s: RendererConfig, target: "cover" | "body"): void {
    if (!this.refs) return;

    const chipMap = target === "cover" ? this.refs.coverEffectChips : this.refs.bodyEffectChips;
    const rowMap = target === "cover" ? this.refs.coverEffectParamRows : this.refs.bodyEffectParamRows;
    const effectMap = target === "cover" ? s.coverEffects : s.bodyEffects;

    for (const [name, chip] of Object.entries(chipMap)) {
      const params = effectMap?.[name];
      const enabled = params?.enabled ?? false;
      chip.classList.toggle("active", enabled);
      const row = rowMap[name];
      if (!row) continue;

      row.classList.toggle("nr-hidden", !enabled);
      const meta = EFFECT_SCHEMAS[name];
      const inputs = row.querySelectorAll<HTMLInputElement>(".nr-field-input");
      if (inputs[0] && params?.opacity != null) inputs[0].value = String(params.opacity);
      const modeSelect = row.querySelector<HTMLSelectElement>(".nr-effect-mode-select");
      if (modeSelect && meta?.defaultMode != null) {
        modeSelect.value = params?.mode ?? meta.defaultMode;
      }
      const shapeSelect = row.querySelector<HTMLSelectElement>(".nr-effect-shape-select");
      if (shapeSelect && meta?.defaultShape != null) {
        shapeSelect.value = params?.shape ?? meta.defaultShape;
      }

      let inputIndex = 1;
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
    this.refs.bodyEffectsSection.classList.toggle("nr-hidden", this.currentPage === 0);
  }

  /** Rescale the current page clone to fit the preview area's width and height */
  private rescale(): void {
    if (!this.currentClone || !this.currentWrapper || !this.refs) return;

    const pageWidth = getPageWidth(this.effectivePageMode);
    const pageHeight = PAGE_HEIGHTS[this.effectivePageMode];
    const horizontalPadding = 24;
    const verticalPadding = 24;
    const maxPreviewWidth = 460;
    const areaWidth = Math.max(1, Math.min(this.refs.previewContainer.clientWidth, maxPreviewWidth) - horizontalPadding);
    const areaHeight = Math.max(1, this.refs.previewContainer.clientHeight - verticalPadding);
    const widthScale = areaWidth / pageWidth;
    const heightScale = areaHeight / pageHeight;
    const scale = Math.max(0.1, Math.min(widthScale, heightScale));
    this.currentClone.setCssStyles({ transform: `scale(${scale})` });
    this.currentWrapper.setCssStyles({ width: `${pageWidth * scale}px`, height: `${pageHeight * scale}px` });

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

  async handleSaveToNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("No active Markdown file");
      return;
    }

    const markdown = await this.app.vault.read(file);
    const activePreset = this.getActivePresetName();
    const updated = activePreset && !this.isPresetModified(this.effective)
      ? savePresetReferenceToNote(markdown, activePreset)
      : saveFullNoteConfig(markdown, extractRenderOptions(this.effective), { activePreset: activePreset || undefined });
    await this.app.vault.modify(file, updated);
    this.baselineSettings = this.cloneSettings(this.effective);
    this.hasNoteConfig = true;
    this.updateNoteActionButtons(true);
    this.syncConfigSourceUi(this.effective);
    new Notice("已存入笔记");
  }

  async handleRemoveFromNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("No active Markdown file");
      return;
    }

    const markdown = await this.app.vault.read(file);
    const updated = removeNoteConfig(markdown);
    await this.app.vault.modify(file, updated);
    this.hasNoteConfig = false;
    this.baselineSettings = createDefaultRendererConfig();
    this.updateNoteActionButtons(false);
    this.syncConfigSourceUi(this.effective);
    new Notice("已从笔记删除配置");
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
