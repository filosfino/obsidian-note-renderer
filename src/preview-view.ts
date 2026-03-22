import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  TAbstractFile,
  Notice,
  setIcon,
  debounce,
} from "obsidian";
import { VIEW_TYPE, PAGE_WIDTH, PAGE_HEIGHTS } from "./constants";
import { renderNote, RenderedPages, RenderOptions } from "./renderer";
import { exportPages } from "./exporter";
import { parseRendererConfig } from "./parser";
import type NoteRendererPlugin from "./main";
import { PRESET_KEYS } from "./main";
import type { NoteRendererSettings } from "./main";

export class PreviewView extends ItemView {
  plugin: NoteRendererPlugin;
  private pages: HTMLElement[] = [];
  private currentPage = 0;
  private rendered: RenderedPages | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private fileChangeHandler: ((file: TAbstractFile) => void) | null = null;
  private activeFileHandler: (() => void) | null = null;

  // DOM refs
  private previewContainer: HTMLElement | null = null;
  private pageDisplay: HTMLElement | null = null;
  private pageIndicator: HTMLElement | null = null;

  // Current displayed clone + wrapper (for rescaling without re-rendering)
  private currentClone: HTMLElement | null = null;
  private currentWrapper: HTMLElement | null = null;
  private effectivePageMode: "long" | "card" = "long";

  // Save/Remove button DOM refs
  private saveToNoteBtn: HTMLElement | null = null;
  private removeFromNoteBtn: HTMLElement | null = null;

  // Section containers for conditional visibility
  private coverSection: HTMLElement | null = null;
  private bodySection: HTMLElement | null = null;

  // Guard: true while syncing UI from renderer_config, prevents change handlers from writing back to global settings
  private syncing = false;

  // Note-config editing mode: when true, UI parameter changes write to note's renderer_config instead of global settings
  private editingNoteConfig = false;
  // The effective settings (global merged with note config) — UI handlers read from this
  private effective: NoteRendererSettings = {} as NoteRendererSettings;
  // Guard: true while writing note config, prevents file-change watcher from triggering refresh
  private writingNoteConfig = false;
  // When true, force using global config even when note has renderer_config (for comparison)
  private forceGlobalConfig = false;
  // Track whether current note actually has a renderer_config
  private hasNoteConfig = false;
  // Mode indicator label ref
  private modeIndicator: HTMLElement | null = null;

  // UI control refs — needed to sync display when renderer_config overrides global settings
  private uiPresetSelect: HTMLSelectElement | null = null;
  private uiThemeSelect: HTMLSelectElement | null = null;
  private uiModeSelect: HTMLSelectElement | null = null;
  private uiSizeLabel: HTMLElement | null = null;
  private uiFontSelect: HTMLSelectElement | null = null;
  private uiCoverFontSelect: HTMLSelectElement | null = null;
  private uiScaleLabel: HTMLElement | null = null;
  private uiLsLabel: HTMLElement | null = null;
  private uiLhLabel: HTMLElement | null = null;
  private uiStrokeStyleSelect: HTMLSelectElement | null = null;
  private uiStrokeLabel: HTMLElement | null = null;
  private uiOpLabel: HTMLElement | null = null;
  private uiGlowLabel: HTMLElement | null = null;
  private uiOverlayToggle: HTMLElement | null = null;
  private uiOxLabel: HTMLElement | null = null;
  private uiOyLabel: HTMLElement | null = null;
  private uiShadowToggle: HTMLElement | null = null;
  private uiBlurLabel: HTMLElement | null = null;
  private uiBannerToggle: HTMLElement | null = null;
  private uiStrokeToggle: HTMLElement | null = null;
  private strokeParamsRow: HTMLElement | null = null;
  private bannerParamsRow: HTMLElement | null = null;
  private shadowParamsRow: HTMLElement | null = null;
  private lastStrokeStyle: string = "stroke";

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
    contentEl.empty();
    contentEl.classList.add("nr-view");

    // ── Row 1: 预设 ──
    const presetBar = contentEl.createDiv("nr-font-bar");
    presetBar.createEl("span", { cls: "nr-row-label", text: "预设" });

    const presetSelect = presetBar.createEl("select", { cls: "nr-select-fixed" });
    this.uiPresetSelect = presetSelect;
    this.rebuildPresetOptions();
    presetSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      const name = presetSelect.value;
      if (name) {
        this.plugin.loadPreset(name);
      } else {
        this.plugin.settings.activePreset = "";
      }
      await this.plugin.saveSettings();
      await this.refresh();
    });

    const presetSaveBtn = presetBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "存" });
    presetSaveBtn.title = "保存当前配置为预设";
    presetSaveBtn.style.minWidth = "36px";
    presetSaveBtn.addEventListener("click", async () => {
      const name = window.prompt("预设名称：", this.plugin.settings.activePreset || "");
      if (!name) return;
      // Save the effective config (which may come from note config), not just global
      const preset: Record<string, unknown> = {};
      for (const key of PRESET_KEYS) {
        preset[key] = (this.effective as Record<string, unknown>)[key];
      }
      this.plugin.settings.presets[name] = preset as any;
      this.plugin.settings.activePreset = name;
      await this.plugin.saveSettings();
      this.rebuildPresetOptions();
      new Notice(`预设「${name}」已保存`);
    });

    const presetDelBtn = presetBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "删" });
    presetDelBtn.title = "删除当前预设";
    presetDelBtn.style.minWidth = "36px";
    presetDelBtn.addEventListener("click", async () => {
      const name = this.plugin.settings.activePreset;
      if (!name) { new Notice("没有选中预设"); return; }
      if (!confirm(`删除预设「${name}」？`)) return;
      this.plugin.deletePreset(name);
      await this.plugin.saveSettings();
      this.rebuildPresetOptions();
      new Notice(`预设「${name}」已删除`);
      await this.refresh();
    });

    // ── Row 3: 主题 ──
    const fontBar = contentEl.createDiv("nr-font-bar");
    fontBar.createEl("span", { cls: "nr-row-label", text: "主题" });

    const themeSelect = fontBar.createEl("select", { cls: "nr-select-fixed" });
    this.uiThemeSelect = themeSelect;
    this.plugin.getThemeNames().forEach((name) => {
      themeSelect.createEl("option", { text: name, value: name });
    });
    themeSelect.value = this.plugin.settings.activeTheme;
    themeSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      await this.updateSetting("activeTheme", themeSelect.value);
    });

    const modeSelect = fontBar.createEl("select", { cls: "nr-select-fixed" });
    this.uiModeSelect = modeSelect;
    modeSelect.createEl("option", { text: "长文 3:5", value: "long" });
    modeSelect.createEl("option", { text: "图文 3:4", value: "card" });
    modeSelect.value = this.plugin.settings.pageMode;
    modeSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      await this.updateSetting("pageMode", modeSelect.value as "long" | "card");
    });

    // ── Cover section ──
    this.coverSection = contentEl.createDiv("nr-cover-section");

    // ── Row 样式: label "样式" + [cover-font-select] + [color-picker] + [默认色] + [- 缩放% +] ──
    const coverBar = this.coverSection.createDiv("nr-font-bar");
    coverBar.createEl("span", { cls: "nr-row-label", text: "文字" });

    const coverFontSelect = coverBar.createEl("select", { cls: "nr-select-fixed" });
    this.uiCoverFontSelect = coverFontSelect;
    [
      // ── 黑体/粗体 ──
      { label: "汉仪旗黑85S", value: '"HYQiHei 85S", "HYQiHei", sans-serif' },
      { label: "汉仪旗黑95S", value: '"HYQiHei 95S", "HYQiHei", sans-serif' },
      { label: "思源黑 Heavy", value: '"Source Han Sans SC Heavy", "Source Han Sans SC", sans-serif' },
      { label: "方正筑紫黑 B", value: '"FZFW ZhuZi HeiS B", "FZFWZhuZiHeiS-B", sans-serif' },
      { label: "苹方", value: '"PingFang SC", "Noto Sans SC", sans-serif' },
      // ── 宋体/明朝 ──
      { label: "方正书宋", value: '"FZShuSong-Z01S", "Songti SC", serif' },
      { label: "方正大标宋", value: '"FZDaBiaoSong-B06S", "Songti SC", serif' },
      { label: "方正标雅宋", value: '"FZYaSongS-R-GB", "Songti SC", serif' },
      { label: "方正筑紫明朝", value: '"FZFW ZhuZi MinchoS L", "Songti SC", serif' },
      { label: "方正筑紫A老明朝", value: '"FZFW ZhuZi A Old Mincho R", "Songti SC", serif' },
      { label: "思源宋体", value: '"Noto Serif SC", "Songti SC", serif' },
      // ── 圆体/可爱 ──
      { label: "圆体", value: '"Yuanti SC", "PingFang SC", sans-serif' },
      { label: "方正兰亭圆", value: '"FZLanTingYuanS-L-GB", "Yuanti SC", sans-serif' },
      { label: "方正卡通", value: '"FZKaTong-M19S", "Wawati SC", sans-serif' },
      { label: "娃娃体", value: '"Wawati SC", "PingFang SC", sans-serif' },
      // ── 楷体/书法 ──
      { label: "方正盛世楷书", value: '"FZShengShiKaiShuS-EB-GB", "Kaiti SC", serif' },
      { label: "方正北魏楷书", value: '"FZBeiWeiKaiShu-Z15S", "Kaiti SC", serif' },
      { label: "方正钟繇小楷", value: '"FZZhongYaoXiaoKaiS", "Kaiti SC", serif' },
      { label: "霞鹜文楷", value: '"LXGW WenKai", "Kaiti SC", serif' },
      { label: "行楷", value: '"Xingkai SC", "Kaiti SC", serif' },
      // ── 手写体 ──
      { label: "字魂镇魂手书", value: '"zihunzhenhunshoushu", sans-serif' },
      { label: "字小魂扶摇手书", value: '"zixiaohunfuyaoshoushu", sans-serif' },
      { label: "字魂水云行楷", value: '"zihunshuiyunxingkai", serif' },
      { label: "字魂相思明月楷", value: '"zihunxiangsimingyuekai", serif' },
      { label: "字魂白鸽天行", value: '"zihunbaigetianxingti", sans-serif' },
      { label: "字魂仙剑奇侠", value: '"zihunxianjianqixiati", sans-serif' },
      { label: "手札体", value: '"Hannotate SC", "PingFang SC", sans-serif' },
      // ── 特殊 ──
      { label: "方正春晚龙马", value: '"FZChunWanLMJSTS", sans-serif' },
      { label: "方正像素12", value: '"FZXS12", monospace' },
      { label: "方正珍珠体", value: '"FZFW ZhenZhuTiS L", sans-serif' },
      // ── 同正文 ──
      { label: "同正文", value: '' },
    ].forEach((f) => coverFontSelect.createEl("option", { text: f.label, value: f.value }));
    coverFontSelect.value = this.plugin.settings.coverFontFamily;
    coverFontSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      await this.updateSetting("coverFontFamily", coverFontSelect.value);
    });

    // Cover font color
    const colorInput = coverBar.createEl("input", { cls: "nr-color-input", type: "color" });
    colorInput.value = this.plugin.settings.coverFontColor || "#e07c5a";
    colorInput.title = "封面文字颜色";
    colorInput.addEventListener("input", async () => {
      await this.updateSetting("coverFontColor", colorInput.value);
    });

    const colorReset = coverBar.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-wide", text: "默认色" });
    colorReset.addEventListener("click", async () => {
      if (this.syncing) return;
      colorInput.value = "#e07c5a";
      await this.updateSetting("coverFontColor", "");
    });

    // Cover font scale: - [value] +
    const scaleStepper = coverBar.createDiv("nr-stepper");
    const scaleDown = scaleStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const scaleLabel = scaleStepper.createDiv({ cls: "nr-font-size-label", text: `${this.plugin.settings.coverFontScale}%` });
    this.uiScaleLabel = scaleLabel;
    const scaleUp = scaleStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    scaleDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.max(50, this.effective.coverFontScale - 10);
      scaleLabel.textContent = `${val}%`;
      await this.updateSetting("coverFontScale", val);
    });
    scaleUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.min(300, this.effective.coverFontScale + 10);
      scaleLabel.textContent = `${val}%`;
      await this.updateSetting("coverFontScale", val);
    });

    // ── Row 排版: label "排版" + [- 间距N +] + [- 行高N +] ──
    const typographyBar = this.coverSection.createDiv("nr-font-bar");
    typographyBar.createEl("span", { cls: "nr-row-label", text: "排版" });

    // Cover letter spacing: - [value] +
    const lsStepper = typographyBar.createDiv("nr-stepper");
    const lsDown = lsStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const lsLabel = lsStepper.createDiv({ cls: "nr-font-size-label", text: `间距${this.plugin.settings.coverLetterSpacing}` });
    this.uiLsLabel = lsLabel;
    const lsUp = lsStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    lsDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.max(-5, this.effective.coverLetterSpacing - 1);
      lsLabel.textContent = `间距${val}`;
      await this.updateSetting("coverLetterSpacing", val);
    });
    lsUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.min(30, this.effective.coverLetterSpacing + 1);
      lsLabel.textContent = `间距${val}`;
      await this.updateSetting("coverLetterSpacing", val);
    });

    // Cover line height: - [value] +
    const lhStepper = typographyBar.createDiv("nr-stepper");
    const lhDown = lhStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const lhLabel = lhStepper.createDiv({ cls: "nr-font-size-label", text: `行高${(this.plugin.settings.coverLineHeight / 10).toFixed(1)}` });
    this.uiLhLabel = lhLabel;
    const lhUp = lhStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    lhDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.max(8, this.effective.coverLineHeight - 1);
      lhLabel.textContent = `行高${(val / 10).toFixed(1)}`;
      await this.updateSetting("coverLineHeight", val);
    });
    lhUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.min(25, this.effective.coverLineHeight + 1);
      lhLabel.textContent = `行高${(val / 10).toFixed(1)}`;
      await this.updateSetting("coverLineHeight", val);
    });

    // ── Row 位置: label "位置" + [- X% +] + [- Y% +] ──
    const offsetBar = this.coverSection.createDiv("nr-font-bar");
    offsetBar.createEl("span", { cls: "nr-row-label", text: "位置" });

    const oxStepper = offsetBar.createDiv("nr-stepper");
    const oxDown = oxStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const oxLabel = oxStepper.createDiv({ cls: "nr-font-size-label", text: `X${this.plugin.settings.coverOffsetX}%` });
    this.uiOxLabel = oxLabel;
    const oxUp = oxStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    oxDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.max(-50, this.effective.coverOffsetX - 1);
      oxLabel.textContent = `X${val}%`;
      await this.updateSetting("coverOffsetX", val);
    });
    oxUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.min(50, this.effective.coverOffsetX + 1);
      oxLabel.textContent = `X${val}%`;
      await this.updateSetting("coverOffsetX", val);
    });

    const oyStepper = offsetBar.createDiv("nr-stepper");
    const oyDown = oyStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const oyLabel = oyStepper.createDiv({ cls: "nr-font-size-label", text: `Y${this.plugin.settings.coverOffsetY}%` });
    this.uiOyLabel = oyLabel;
    const oyUp = oyStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    oyDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.max(-50, this.effective.coverOffsetY - 1);
      oyLabel.textContent = `Y${val}%`;
      await this.updateSetting("coverOffsetY", val);
    });
    oyUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.min(50, this.effective.coverOffsetY + 1);
      oyLabel.textContent = `Y${val}%`;
      await this.updateSetting("coverOffsetY", val);
    });

    // ── Row 效果: label "效果" + [遮罩 toggle] + [描边 toggle] + [色带 toggle] + [投影 toggle] ──
    const effectRow = this.coverSection.createDiv("nr-font-bar");
    effectRow.createEl("span", { cls: "nr-row-label", text: "效果" });

    // 遮罩 toggle
    const overlayToggle = effectRow.createEl("button", {
      cls: `nr-btn nr-btn-sm nr-btn-wide${this.plugin.settings.coverOverlay ? " nr-btn-active" : ""}`,
      text: "遮罩",
    });
    this.uiOverlayToggle = overlayToggle;
    overlayToggle.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = !this.effective.coverOverlay;
      overlayToggle.classList.toggle("nr-btn-active", val);
      await this.updateSetting("coverOverlay", val);
    });

    // 描边 toggle
    this.lastStrokeStyle = this.plugin.settings.coverStrokeStyle !== "none" ? this.plugin.settings.coverStrokeStyle : "stroke";
    const strokeEnabled = this.plugin.settings.coverStrokeStyle !== "none";

    const strokeToggle = effectRow.createEl("button", {
      cls: `nr-btn nr-btn-sm nr-btn-wide${strokeEnabled ? " nr-btn-active" : ""}`,
      text: "描边",
    });
    this.uiStrokeToggle = strokeToggle;

    // 色带 toggle
    const bannerToggle = effectRow.createEl("button", {
      cls: `nr-btn nr-btn-sm nr-btn-wide${this.plugin.settings.coverBanner ? " nr-btn-active" : ""}`,
      text: "色带",
    });
    this.uiBannerToggle = bannerToggle;

    // 投影 toggle
    const shadowToggle = effectRow.createEl("button", {
      cls: `nr-btn nr-btn-sm nr-btn-wide${this.plugin.settings.coverShadow ? " nr-btn-active" : ""}`,
      text: "投影",
    });
    this.uiShadowToggle = shadowToggle;

    // ── Row 描边参数: label "  " + [stroke-style-select] + [- 粗N +] + [- 透N +] + [- 光N +] ──
    const strokeParamsRow = this.coverSection.createDiv("nr-font-bar");
    this.strokeParamsRow = strokeParamsRow;
    strokeParamsRow.createEl("span", { cls: "nr-row-label nr-sub-label", text: "描边" });
    strokeParamsRow.style.display = strokeEnabled ? "" : "none";

    // Stroke style select
    const strokeStyleSelect = strokeParamsRow.createEl("select", { cls: "nr-select-fixed" });
    this.uiStrokeStyleSelect = strokeStyleSelect;
    [
      { label: "描边", value: "stroke" },
      { label: "双层", value: "double" },
      { label: "发光", value: "glow" },
    ].forEach((s) => strokeStyleSelect.createEl("option", { text: s.label, value: s.value }));
    strokeStyleSelect.value = strokeEnabled ? this.plugin.settings.coverStrokeStyle : this.lastStrokeStyle;

    // Stroke percent: − [粗X] +
    const strokeStepper = strokeParamsRow.createDiv("nr-stepper");
    const strokeDown = strokeStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const strokeLabel = strokeStepper.createDiv({ cls: "nr-font-size-label", text: `粗${this.plugin.settings.coverStrokePercent}` });
    this.uiStrokeLabel = strokeLabel;
    const strokeUp = strokeStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    strokeDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.max(0, this.effective.coverStrokePercent - 1);
      strokeLabel.textContent = `粗${val}`;
      await this.updateSetting("coverStrokePercent", val);
    });
    strokeUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.min(100, this.effective.coverStrokePercent + 1);
      strokeLabel.textContent = `粗${val}`;
      await this.updateSetting("coverStrokePercent", val);
    });

    // Stroke opacity: − [透X] +
    const opStepper = strokeParamsRow.createDiv("nr-stepper");
    const opDown = opStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const opLabel = opStepper.createDiv({ cls: "nr-font-size-label", text: `透${this.plugin.settings.coverStrokeOpacity}` });
    this.uiOpLabel = opLabel;
    const opUp = opStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    opDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.max(0, this.effective.coverStrokeOpacity - 10);
      opLabel.textContent = `透${val}`;
      await this.updateSetting("coverStrokeOpacity", val);
    });
    opUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.min(100, this.effective.coverStrokeOpacity + 10);
      opLabel.textContent = `透${val}`;
      await this.updateSetting("coverStrokeOpacity", val);
    });

    // Glow size: − [光X] +
    const glowStepper = strokeParamsRow.createDiv("nr-stepper");
    const glowDown = glowStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const glowLabel = glowStepper.createDiv({ cls: "nr-font-size-label", text: `光${this.plugin.settings.coverGlowSize}` });
    this.uiGlowLabel = glowLabel;
    const glowUp = glowStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    glowDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.max(0, this.effective.coverGlowSize - 10);
      glowLabel.textContent = `光${val}`;
      await this.updateSetting("coverGlowSize", val);
    });
    glowUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.min(200, this.effective.coverGlowSize + 10);
      glowLabel.textContent = `光${val}`;
      await this.updateSetting("coverGlowSize", val);
    });

    // Glow stepper visibility: only for "double" and "glow" styles
    const updateGlowVisibility = () => {
      const mode = strokeStyleSelect.value;
      const hasGlow = mode === "double" || mode === "glow";
      glowStepper.style.display = hasGlow ? "" : "none";
    };
    updateGlowVisibility();

    // Stroke style select change handler
    strokeStyleSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      const style = strokeStyleSelect.value as any;
      this.lastStrokeStyle = style;
      const defaults: Record<string, number> = { stroke: 20, double: 5, glow: 6 };
      const newPercent = defaults[style] ?? 8;
      strokeLabel.textContent = `粗${newPercent}`;
      updateGlowVisibility();
      if (this.editingNoteConfig) {
        await this.updateNoteConfig("coverStrokeStyle", style);
        await this.updateNoteConfig("coverStrokePercent", newPercent);
        await this.refresh();
      } else {
        this.plugin.settings.coverStrokeStyle = style;
        this.plugin.settings.coverStrokePercent = newPercent;
        this.plugin.settings.activePreset = "";
        if (this.uiPresetSelect) this.uiPresetSelect.value = "";
        await this.plugin.saveSettings();
        await this.refresh();
      }
    });

    // 描边 toggle handler
    strokeToggle.addEventListener("click", async () => {
      if (this.syncing) return;
      const currentStyle = this.effective.coverStrokeStyle;
      if (currentStyle !== "none") {
        // Turn off: save current style, set to none
        this.lastStrokeStyle = currentStyle;
        strokeToggle.classList.remove("nr-btn-active");
        strokeParamsRow.style.display = "none";
        await this.updateSetting("coverStrokeStyle", "none");
      } else {
        // Turn on: restore last style
        strokeToggle.classList.add("nr-btn-active");
        strokeParamsRow.style.display = "";
        strokeStyleSelect.value = this.lastStrokeStyle;
        updateGlowVisibility();
        await this.updateSetting("coverStrokeStyle", this.lastStrokeStyle);
      }
    });

    // ── Row 色带参数: label "  " + [color-picker] + [- 透明度% +] + [- 斜N +] ──
    const bannerParamsRow = this.coverSection.createDiv("nr-font-bar");
    this.bannerParamsRow = bannerParamsRow;
    bannerParamsRow.createEl("span", { cls: "nr-row-label nr-sub-label", text: "色带" });
    bannerParamsRow.style.display = this.plugin.settings.coverBanner ? "" : "none";

    // Parse rgba to hex for color picker
    const parseColor = (c: string) => {
      if (c.startsWith("#")) return c;
      const m = c.match(/[\d.]+/g);
      if (!m) return "#000000";
      return "#" + [0,1,2].map(i => Math.round(Number(m[i])).toString(16).padStart(2, "0")).join("");
    };
    const bannerColorInput = bannerParamsRow.createEl("input", { type: "color" });
    bannerColorInput.value = parseColor(this.plugin.settings.coverBannerColor);

    const bannerAlpha = Math.round((parseFloat((this.plugin.settings.coverBannerColor.match(/[\d.]+/g) || [])[3] ?? "0.5") * 100));
    let currentAlpha = bannerAlpha / 100;

    const bannerAlphaStepper = bannerParamsRow.createDiv("nr-stepper");
    const bannerAlphaDown = bannerAlphaStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const bannerAlphaLabel = bannerAlphaStepper.createDiv({ cls: "nr-font-size-label", text: `${bannerAlpha}%` });
    const bannerAlphaUp = bannerAlphaStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });

    const skewStepper = bannerParamsRow.createDiv("nr-stepper");
    const skewDown = skewStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const skewLabel = skewStepper.createDiv({ cls: "nr-font-size-label", text: `斜${this.plugin.settings.coverBannerSkew}` });
    const skewUp = skewStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });

    bannerToggle.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = !this.effective.coverBanner;
      bannerToggle.classList.toggle("nr-btn-active", val);
      bannerParamsRow.style.display = val ? "" : "none";
      await this.updateSetting("coverBanner", val);
    });

    const updateBannerColor = async () => {
      const hex = bannerColorInput.value;
      const r = parseInt(hex.slice(1,3), 16);
      const g = parseInt(hex.slice(3,5), 16);
      const b = parseInt(hex.slice(5,7), 16);
      const rgba = `rgba(${r},${g},${b},${currentAlpha})`;
      bannerAlphaLabel.textContent = `${Math.round(currentAlpha * 100)}%`;
      await this.updateSetting("coverBannerColor", rgba);
    };
    bannerColorInput.addEventListener("input", updateBannerColor);
    bannerAlphaDown.addEventListener("click", async () => {
      currentAlpha = Math.max(0, Math.round((currentAlpha - 0.1) * 10) / 10);
      await updateBannerColor();
    });
    bannerAlphaUp.addEventListener("click", async () => {
      currentAlpha = Math.min(1, Math.round((currentAlpha + 0.1) * 10) / 10);
      await updateBannerColor();
    });
    skewDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.max(0, this.effective.coverBannerSkew - 1);
      skewLabel.textContent = `斜${val}`;
      await this.updateSetting("coverBannerSkew", val);
    });
    skewUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.min(20, this.effective.coverBannerSkew + 1);
      skewLabel.textContent = `斜${val}`;
      await this.updateSetting("coverBannerSkew", val);
    });

    // ── Row 投影参数: label "  " + [- 模糊N +] + [- XN +] + [- YN +] ──
    const shadowParamsRow = this.coverSection.createDiv("nr-font-bar");
    this.shadowParamsRow = shadowParamsRow;
    shadowParamsRow.createEl("span", { cls: "nr-row-label nr-sub-label", text: "投影" });
    shadowParamsRow.style.display = this.plugin.settings.coverShadow ? "" : "none";

    shadowToggle.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = !this.effective.coverShadow;
      shadowToggle.classList.toggle("nr-btn-active", val);
      shadowParamsRow.style.display = val ? "" : "none";
      await this.updateSetting("coverShadow", val);
    });

    // Shadow blur: - [value] +
    const blurStepper = shadowParamsRow.createDiv("nr-stepper");
    const blurDown = blurStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const blurLabel = blurStepper.createDiv({ cls: "nr-font-size-label", text: `模糊${this.plugin.settings.coverShadowBlur}` });
    this.uiBlurLabel = blurLabel;
    const blurUp = blurStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    blurDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = this.effective.coverShadowBlur - 5;
      blurLabel.textContent = `模糊${val}`;
      await this.updateSetting("coverShadowBlur", val);
    });
    blurUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = this.effective.coverShadowBlur + 5;
      blurLabel.textContent = `模糊${val}`;
      await this.updateSetting("coverShadowBlur", val);
    });

    // Shadow offset X: - [value] +
    const offXStepper = shadowParamsRow.createDiv("nr-stepper");
    const offXDown = offXStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const offXLabel = offXStepper.createDiv({ cls: "nr-font-size-label", text: `X${this.plugin.settings.coverShadowOffsetX}` });
    const offXUp = offXStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    offXDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = this.effective.coverShadowOffsetX - 5;
      offXLabel.textContent = `X${val}`;
      await this.updateSetting("coverShadowOffsetX", val);
    });
    offXUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = this.effective.coverShadowOffsetX + 5;
      offXLabel.textContent = `X${val}`;
      await this.updateSetting("coverShadowOffsetX", val);
    });

    // Shadow offset Y: - [value] +
    const offYStepper = shadowParamsRow.createDiv("nr-stepper");
    const offYDown = offYStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const offYLabel = offYStepper.createDiv({ cls: "nr-font-size-label", text: `Y${this.plugin.settings.coverShadowOffsetY}` });
    const offYUp = offYStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    offYDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = this.effective.coverShadowOffsetY - 5;
      offYLabel.textContent = `Y${val}`;
      await this.updateSetting("coverShadowOffsetY", val);
    });
    offYUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = this.effective.coverShadowOffsetY + 5;
      offYLabel.textContent = `Y${val}`;
      await this.updateSetting("coverShadowOffsetY", val);
    });

    // ── Body section ──
    this.bodySection = contentEl.createDiv("nr-body-section");

    // ── Row: 字体 ──
    const bodyFontBar = this.bodySection.createDiv("nr-font-bar");
    bodyFontBar.createEl("span", { cls: "nr-row-label", text: "字体" });

    // Font size: - [value] +
    const sizeStepper = bodyFontBar.createDiv("nr-stepper");
    const sizeDown = sizeStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const sizeLabel = sizeStepper.createDiv({ cls: "nr-font-size-label", text: `${this.plugin.settings.fontSize}px` });
    this.uiSizeLabel = sizeLabel;
    const sizeUp = sizeStepper.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });

    sizeDown.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.max(24, this.effective.fontSize - 2);
      sizeLabel.textContent = `${val}px`;
      await this.updateSetting("fontSize", val);
    });
    sizeUp.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = Math.min(72, this.effective.fontSize + 2);
      sizeLabel.textContent = `${val}px`;
      await this.updateSetting("fontSize", val);
    });

    // Font family select
    const fontSelect = bodyFontBar.createEl("select", { cls: "nr-select-fixed" });
    this.uiFontSelect = fontSelect;
    const fonts = [
      // ── 黑体 ──
      { label: "苹方", value: '"PingFang SC", "Noto Sans SC", sans-serif' },
      { label: "冬青黑", value: '"Hiragino Sans GB", "PingFang SC", sans-serif' },
      { label: "思源黑体", value: '"Source Han Sans SC", "Noto Sans SC", sans-serif' },
      { label: "思源黑 Medium", value: '"Source Han Sans SC Medium", "Noto Sans SC", sans-serif' },
      { label: "微软雅黑", value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
      { label: "方正兰亭黑", value: '"FZLanTingHeiS-R-GB", "PingFang SC", sans-serif' },
      { label: "方正悠黑", value: '"FZYouHeiS 508R", "PingFang SC", sans-serif' },
      { label: "方正筑紫黑 R", value: '"FZFW ZhuZi HeiS R", "PingFang SC", sans-serif' },
      { label: "方正筑紫黑 M", value: '"FZFW ZhuZi HeiS M", "PingFang SC", sans-serif' },
      { label: "汉仪旗黑 55S", value: '"HYQiHei 55S", "HYQiHei", sans-serif' },
      { label: "汉仪旗黑 65S", value: '"HYQiHei 65S", "HYQiHei", sans-serif' },
      { label: "霞鹜尚智黑", value: '"LXGW Fasmart Gothic", "PingFang SC", sans-serif' },
      { label: "霞鹜漫黑", value: '"LXGW Marker Gothic", "PingFang SC", sans-serif' },
      { label: "霞鹜新晰黑", value: '"LXGW Neo XiHei", "PingFang SC", sans-serif' },
      // ── 宋体/明朝 ──
      { label: "宋体 SC", value: '"Songti SC", serif' },
      { label: "思源宋体", value: '"Noto Serif SC", "Songti SC", serif' },
      { label: "方正书宋", value: '"FZShuSong-Z01S", "Songti SC", serif' },
      { label: "方正屏显雅宋", value: '"FZPingXianYaSongS-R-GB", "Songti SC", serif' },
      { label: "方正标雅宋", value: '"FZYaSongS-R-GB", "Songti SC", serif' },
      { label: "方正细雅宋", value: '"FZYaSongS-L-GB", "Songti SC", serif' },
      { label: "方正纤雅宋", value: '"FZYaSongS-EL-GB", "Songti SC", serif' },
      { label: "方正大标宋", value: '"FZDaBiaoSong-B06S", "Songti SC", serif' },
      { label: "方正粗宋", value: '"FZCuSong-B09S", "Songti SC", serif' },
      { label: "方正筑紫明朝", value: '"FZFW ZhuZi MinchoS L", "Songti SC", serif' },
      { label: "方正筑紫A老明朝", value: '"FZFW ZhuZi A Old Mincho R", "Songti SC", serif' },
      { label: "霞鹜新致宋", value: '"LXGW Neo ZhiSong", "Songti SC", serif' },
      { label: "霞鹜铭心宋", value: '"LXGW Heart Serif", "Songti SC", serif' },
      // ── 仿宋 ──
      { label: "方正仿宋", value: '"FZFangSong-Z02S", "STFangsong", serif' },
      { label: "方正刻本仿宋", value: '"FZKeBenFangSongS-R-GB", "STFangsong", serif' },
      // ── 圆体 ──
      { label: "圆体", value: '"Yuanti SC", "PingFang SC", sans-serif' },
      { label: "方正兰亭圆", value: '"FZLanTingYuanS-L-GB", "Yuanti SC", sans-serif' },
      { label: "方正粗圆", value: '"FZCuYuan-M03S", "Yuanti SC", sans-serif' },
      { label: "方正卡通", value: '"FZKaTong-M19S", "Wawati SC", sans-serif' },
      { label: "娃娃体", value: '"Wawati SC", "PingFang SC", sans-serif' },
      // ── 楷体/书法 ──
      { label: "楷体 SC", value: '"Kaiti SC", "STKaiti", serif' },
      { label: "方正楷体", value: '"FZKai-Z03S", "Kaiti SC", serif' },
      { label: "方正新楷体", value: '"FZNewKai-Z03S", "Kaiti SC", serif' },
      { label: "方正盛世楷书", value: '"FZShengShiKaiShuS-EB-GB", "Kaiti SC", serif' },
      { label: "方正北魏楷书", value: '"FZBeiWeiKaiShu-Z15S", "Kaiti SC", serif' },
      { label: "方正钟繇小楷", value: '"FZZhongYaoXiaoKaiS", "Kaiti SC", serif' },
      { label: "霞鹜文楷", value: '"LXGW WenKai", "Kaiti SC", serif' },
      { label: "霞鹜文楷 GB", value: '"LXGW WenKai GB", "Kaiti SC", serif' },
      { label: "霞鹜 Bright", value: '"LXGW Bright", "LXGW WenKai", serif' },
      { label: "华文行楷", value: '"Xingkai SC", "STXingkai", serif' },
      // ── 手写/特殊 ──
      { label: "字魂镇魂手书", value: '"zihunzhenhunshoushu", sans-serif' },
      { label: "字小魂扶摇手书", value: '"zixiaohunfuyaoshoushu", sans-serif' },
      { label: "字魂水云行楷", value: '"zihunshuiyunxingkai", serif' },
      { label: "字魂相思明月楷", value: '"zihunxiangsimingyuekai", serif' },
      { label: "字魂白鸽天行", value: '"zihunbaigetianxingti", sans-serif' },
      { label: "字魂仙剑奇侠", value: '"zihunxianjianqixiati", sans-serif' },
      { label: "方正FW珍珠体", value: '"FZFW ZhenZhuTiS L", sans-serif' },
      // ── 系统 ──
      { label: "系统默认", value: '-apple-system, "PingFang SC", sans-serif' },
    ];
    fonts.forEach((f) => {
      fontSelect.createEl("option", { text: f.label, value: f.value });
    });
    fontSelect.value = this.plugin.settings.fontFamily;
    fontSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      await this.updateSetting("fontFamily", fontSelect.value);
    });

    // Preview area
    this.previewContainer = contentEl.createDiv("nr-preview-area");
    this.pageDisplay = this.previewContainer.createDiv("nr-page-display");

    // Navigation — 3-column layout
    const nav = contentEl.createDiv("nr-nav");

    // Left: mode indicator only
    const navLeft = nav.createDiv("nr-nav-left");
    this.modeIndicator = navLeft.createEl("span", { cls: "nr-mode-indicator nr-clickable" });
    this.modeIndicator.addEventListener("click", async () => {
      if (!this.hasNoteConfig) return; // nothing to toggle when no note config
      this.forceGlobalConfig = !this.forceGlobalConfig;
      await this.refresh();
    });

    // Center: pagination
    const navCenter = nav.createDiv("nr-nav-center");
    const prevBtn = navCenter.createEl("button", { cls: "nr-nav-btn" });
    setIcon(prevBtn, "chevron-left");
    prevBtn.addEventListener("click", () => this.goPage(-1));
    this.pageIndicator = navCenter.createDiv("nr-page-indicator");
    const nextBtn = navCenter.createEl("button", { cls: "nr-nav-btn" });
    setIcon(nextBtn, "chevron-right");
    nextBtn.addEventListener("click", () => this.goPage(1));

    // Right: actions + export
    const navRight = nav.createDiv("nr-nav-right");

    this.saveToNoteBtn = navRight.createEl("button", { cls: "nr-btn nr-btn-sm", text: "存入笔记" });
    this.saveToNoteBtn.title = "保存当前配置到笔记";
    this.saveToNoteBtn.style.minWidth = "72px";
    this.saveToNoteBtn.addEventListener("click", () => this.handleSaveToNote());

    this.removeFromNoteBtn = navRight.createEl("button", { cls: "nr-btn nr-btn-sm", text: "移除" });
    this.removeFromNoteBtn.title = "移除笔记中的渲染配置";
    this.removeFromNoteBtn.style.minWidth = "48px";
    this.removeFromNoteBtn.addEventListener("click", () => this.handleRemoveFromNote());


    navRight.createDiv({ cls: "nr-nav-separator" });

    const exportBtn = navRight.createEl("button", { cls: "nr-nav-btn" });
    setIcon(exportBtn, "download");
    exportBtn.title = "导出 ZIP";
    exportBtn.addEventListener("click", () => this.handleExport());

    // ResizeObserver — rescale on sidebar width change
    this.resizeObserver = new ResizeObserver(() => {
      this.rescale();
    });
    this.resizeObserver.observe(this.previewContainer);

    // Watch for file changes — auto-refresh when the current note is modified
    const debouncedRefresh = debounce(() => this.refresh(), 500, true);

    this.fileChangeHandler = (file: TAbstractFile) => {
      if (this.writingNoteConfig) return; // Skip refresh when we're writing note config
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && file.path === activeFile.path) {
        debouncedRefresh();
      }
    };
    this.app.vault.on("modify", this.fileChangeHandler);

    // Watch for active file change — refresh when switching notes
    this.activeFileHandler = () => {
      this.forceGlobalConfig = false; // reset when switching notes
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
    const noteConfig = parseRendererConfig(markdown);
    this.hasNoteConfig = !!noteConfig;

    // When forceGlobalConfig is on, skip merging note config (for comparison)
    const useNoteConfig = noteConfig && !this.forceGlobalConfig;

    const merged: NoteRendererSettings = Object.assign({}, this.plugin.settings);
    if (useNoteConfig) {
      for (const [key, value] of Object.entries(noteConfig)) {
        if (key in merged && value !== undefined && value !== null) {
          (merged as Record<string, unknown>)[key] = value;
        }
      }
    }

    // Store effective settings for UI handlers to read from
    this.effective = merged;

    // Update editing mode state — only edit note config when actually using it
    this.editingNoteConfig = !!useNoteConfig;

    // Update save/remove button visibility (based on actual note config existence, not force toggle)
    if (this.saveToNoteBtn) {
      this.saveToNoteBtn.style.display = noteConfig ? "none" : "";
    }
    if (this.removeFromNoteBtn) {
      this.removeFromNoteBtn.style.display = noteConfig ? "" : "none";
    }

    // Update mode indicator — show which config is being used for rendering
    if (this.modeIndicator) {
      if (!noteConfig) {
        this.modeIndicator.textContent = "⚙️ 全局配置";
        this.modeIndicator.title = "";
        this.modeIndicator.style.cursor = "default";
      } else if (this.forceGlobalConfig) {
        this.modeIndicator.textContent = "⚙️ 全局配置";
        this.modeIndicator.title = "点击切回笔记配置";
        this.modeIndicator.style.cursor = "pointer";
      } else {
        this.modeIndicator.textContent = "📌 笔记配置";
        this.modeIndicator.title = "点击查看全局配置效果";
        this.modeIndicator.style.cursor = "pointer";
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
      {
        fontSize: merged.fontSize,
        fontFamily: merged.fontFamily,
        coverFontFamily: merged.coverFontFamily,
        coverFontScale: merged.coverFontScale,
        coverFontColor: merged.coverFontColor,
        coverLetterSpacing: merged.coverLetterSpacing,
        coverLineHeight: merged.coverLineHeight,
        coverStrokePercent: merged.coverStrokePercent,
        coverStrokeStyle: merged.coverStrokeStyle,
        coverStrokeOpacity: merged.coverStrokeOpacity,
        coverGlowSize: merged.coverGlowSize,
        coverBanner: merged.coverBanner,
        coverBannerColor: merged.coverBannerColor,
        coverBannerSkew: merged.coverBannerSkew,
        coverOffsetX: merged.coverOffsetX,
        coverOffsetY: merged.coverOffsetY,
        coverOverlay: merged.coverOverlay,
        coverShadow: merged.coverShadow,
        coverShadowBlur: merged.coverShadowBlur,
        coverShadowOffsetX: merged.coverShadowOffsetX,
        coverShadowOffsetY: merged.coverShadowOffsetY,
        pageMode: merged.pageMode,
      }
    );

    this.pages = this.rendered.pages;
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
  private async updateSetting<K extends keyof NoteRendererSettings>(
    key: K, value: NoteRendererSettings[K]
  ): Promise<void> {
    if (this.editingNoteConfig) {
      await this.updateNoteConfig(key as string, value);
    } else {
      this.plugin.settings[key] = value;
      // Clear active preset since user manually changed a setting
      if (key !== "activePreset") this.plugin.settings.activePreset = "";
      if (this.uiPresetSelect) this.uiPresetSelect.value = "";
      await this.plugin.saveSettings();
    }
    await this.refresh();
  }

  /**
   * Update a single key in the active note's renderer_config JSON.
   * Reads the note, modifies the JSON, writes it back.
   */
  private async updateNoteConfig(key: string, value: unknown): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") return;

    const markdown = await this.app.vault.read(file);
    const noteConfig = parseRendererConfig(markdown);
    if (!noteConfig) return;

    // Update the key in the parsed config
    noteConfig[key] = value;

    // Rebuild the JSON and replace in markdown
    const configJson = JSON.stringify(noteConfig, null, 2);
    const configSection = `\n## renderer_config\n\n\`\`\`json\n${configJson}\n\`\`\`\n`;
    const newContent = removeRendererConfigSection(markdown).trimEnd() + configSection;

    // Re-insert before ## 正文描述 if possible
    const finalContent = insertRendererConfigSection(
      removeRendererConfigSection(markdown),
      configSection
    );

    this.writingNoteConfig = true;
    await this.app.vault.modify(file, finalContent);
    // Reset guard after a tick to allow the file watcher to settle
    setTimeout(() => { this.writingNoteConfig = false; }, 100);
  }

  /** Rebuild preset dropdown options from current settings. */
  private rebuildPresetOptions(): void {
    if (!this.uiPresetSelect) return;
    this.uiPresetSelect.empty();
    this.uiPresetSelect.createEl("option", { text: "(无预设)", value: "" });
    for (const name of this.plugin.getPresetNames()) {
      this.uiPresetSelect.createEl("option", { text: name, value: name });
    }
    this.uiPresetSelect.value = this.plugin.settings.activePreset;
  }

  /** Sync UI control display values to reflect effective settings (e.g. after renderer_config override). */
  private syncUiToSettings(s: NoteRendererSettings): void {
    this.syncing = true;
    if (this.uiPresetSelect) this.uiPresetSelect.value = this.plugin.settings.activePreset;
    if (this.uiThemeSelect) this.uiThemeSelect.value = s.activeTheme;
    if (this.uiModeSelect) this.uiModeSelect.value = s.pageMode;
    if (this.uiSizeLabel) this.uiSizeLabel.textContent = `${s.fontSize}px`;
    if (this.uiFontSelect) this.uiFontSelect.value = s.fontFamily;
    if (this.uiCoverFontSelect) this.uiCoverFontSelect.value = s.coverFontFamily;
    if (this.uiScaleLabel) this.uiScaleLabel.textContent = `${s.coverFontScale}%`;
    if (this.uiLsLabel) this.uiLsLabel.textContent = `间距${s.coverLetterSpacing}`;
    if (this.uiLhLabel) this.uiLhLabel.textContent = `行高${(s.coverLineHeight / 10).toFixed(1)}`;
    if (this.uiStrokeStyleSelect) this.uiStrokeStyleSelect.value = s.coverStrokeStyle;
    if (this.uiStrokeLabel) this.uiStrokeLabel.textContent = `粗${s.coverStrokePercent}`;
    if (this.uiOpLabel) this.uiOpLabel.textContent = `透${s.coverStrokeOpacity}`;
    if (this.uiGlowLabel) this.uiGlowLabel.textContent = `光${s.coverGlowSize}`;
    if (this.uiOverlayToggle) this.uiOverlayToggle.classList.toggle("nr-btn-active", s.coverOverlay);
    if (this.uiOxLabel) this.uiOxLabel.textContent = `X${s.coverOffsetX}%`;
    if (this.uiOyLabel) this.uiOyLabel.textContent = `Y${s.coverOffsetY}%`;
    if (this.uiShadowToggle) this.uiShadowToggle.classList.toggle("nr-btn-active", s.coverShadow);
    if (this.uiBlurLabel) this.uiBlurLabel.textContent = `模糊${s.coverShadowBlur}`;
    if (this.uiBannerToggle) this.uiBannerToggle.classList.toggle("nr-btn-active", s.coverBanner);
    if (this.uiStrokeToggle) {
      const on = s.coverStrokeStyle !== "none";
      this.uiStrokeToggle.classList.toggle("nr-btn-active", on);
    }
    if (this.strokeParamsRow) this.strokeParamsRow.style.display = s.coverStrokeStyle !== "none" ? "" : "none";
    if (this.bannerParamsRow) this.bannerParamsRow.style.display = s.coverBanner ? "" : "none";
    if (this.shadowParamsRow) this.shadowParamsRow.style.display = s.coverShadow ? "" : "none";
    this.syncing = false;
  }

  /** Save current UI settings as renderer_config into the active note. */
  private async handleSaveToNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("No active markdown file");
      return;
    }
    const markdown = await this.app.vault.read(file);
    const s = this.plugin.settings;
    const configJson = JSON.stringify({
      activeTheme: s.activeTheme,
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      coverFontFamily: s.coverFontFamily,
      coverFontScale: s.coverFontScale,
      coverFontColor: s.coverFontColor,
      coverLetterSpacing: s.coverLetterSpacing,
      coverLineHeight: s.coverLineHeight,
      coverStrokePercent: s.coverStrokePercent,
      coverStrokeStyle: s.coverStrokeStyle,
      coverStrokeOpacity: s.coverStrokeOpacity,
      coverGlowSize: s.coverGlowSize,
      coverBanner: s.coverBanner,
      coverBannerColor: s.coverBannerColor,
      coverBannerSkew: s.coverBannerSkew,
      coverShadow: s.coverShadow,
      coverShadowBlur: s.coverShadowBlur,
      coverOffsetX: s.coverOffsetX,
      coverOffsetY: s.coverOffsetY,
      coverOverlay: s.coverOverlay,
      coverShadowOffsetX: s.coverShadowOffsetX,
      coverShadowOffsetY: s.coverShadowOffsetY,
      pageMode: s.pageMode,
    }, null, 2);
    const configSection = `\n## renderer_config\n\n\`\`\`json\n${configJson}\n\`\`\`\n`;
    const newContent = insertRendererConfigSection(markdown, configSection);
    await this.app.vault.modify(file, newContent);
    new Notice("已存入笔记");
  }

  /** Remove renderer_config section from the active note. */
  private async handleRemoveFromNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("No active markdown file");
      return;
    }
    const markdown = await this.app.vault.read(file);
    const newContent = removeRendererConfigSection(markdown);
    await this.app.vault.modify(file, newContent);
    new Notice("已移除笔记配置");
  }

  private showPage(): void {
    if (!this.pageDisplay || !this.pageIndicator) return;

    this.pageDisplay.empty();
    this.currentClone = null;
    this.currentWrapper = null;

    if (this.pages.length === 0) {
      this.showEmpty("No content to render");
      return;
    }

    const page = this.pages[this.currentPage];
    this.currentWrapper = this.pageDisplay.createDiv("nr-page-wrapper");

    this.currentClone = page.cloneNode(true) as HTMLElement;
    this.currentClone.style.transformOrigin = "top left";
    this.currentWrapper.appendChild(this.currentClone);

    this.rescale();

    this.pageIndicator.textContent = `${this.currentPage + 1} / ${this.pages.length}`;

    // Show/hide sections based on current page
    if (this.coverSection) {
      this.coverSection.style.display = this.currentPage === 0 ? "" : "none";
    }
    if (this.bodySection) {
      this.bodySection.style.display = this.currentPage === 0 ? "none" : "";
    }
  }

  /** Rescale the current page clone to fit the container width */
  private rescale(): void {
    if (!this.currentClone || !this.currentWrapper || !this.previewContainer) return;

    const pageHeight = PAGE_HEIGHTS[this.effectivePageMode];
    const areaWidth = this.previewContainer.clientWidth;
    const scale = (areaWidth - 24) / PAGE_WIDTH;
    this.currentClone.style.transform = `scale(${scale})`;
    this.currentWrapper.style.width = `${PAGE_WIDTH * scale}px`;
    this.currentWrapper.style.height = `${pageHeight * scale}px`;
  }

  private showEmpty(msg: string): void {
    if (!this.pageDisplay) return;
    this.pageDisplay.empty();
    this.currentClone = null;
    this.currentWrapper = null;
    this.pageDisplay.createDiv({ cls: "nr-empty", text: msg });
    if (this.pageIndicator) this.pageIndicator.textContent = "";
  }

  private goPage(delta: number): void {
    const next = this.currentPage + delta;
    if (next >= 0 && next < this.pages.length) {
      this.currentPage = next;
      this.showPage();
    }
  }

  private async handleExport(): Promise<void> {
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

// ── renderer_config section helpers ──────────────────────────────────────────

/**
 * Remove `## renderer_config` section (and its content) from markdown.
 */
function removeRendererConfigSection(markdown: string): string {
  // Match from `## renderer_config` to the next H2 or end of string
  return markdown.replace(/\n## renderer_config\n[\s\S]*?(?=\n## |\n*$)/, "").trimEnd() + "\n";
}

/**
 * Insert renderer_config section into markdown.
 * Inserts before `## 正文描述` if it exists, otherwise appends at end.
 */
function insertRendererConfigSection(markdown: string, configSection: string): string {
  // Insert before ## 正文描述 if present
  const insertBefore = /(\n## 正文描述\n)/;
  if (insertBefore.test(markdown)) {
    return markdown.replace(insertBefore, `${configSection}$1`);
  }
  // Otherwise append at end
  return markdown.trimEnd() + "\n" + configSection;
}
