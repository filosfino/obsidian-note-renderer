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

  // Lock button DOM ref (updated when config lock state changes)
  private lockBtn: HTMLElement | null = null;

  // Guard: true while syncing UI from renderer_config, prevents change handlers from writing back to global settings
  private syncing = false;

  // UI control refs — needed to sync display when renderer_config overrides global settings
  private uiTemplateSelect: HTMLSelectElement | null = null;
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

    // Toolbar
    const toolbar = contentEl.createDiv("nr-toolbar");

    const templateSelect = toolbar.createEl("select", { cls: "nr-template-select" });
    this.uiTemplateSelect = templateSelect;
    this.plugin.getTemplateNames().forEach((name) => {
      templateSelect.createEl("option", { text: name, value: name });
    });
    templateSelect.value = this.plugin.settings.activeTemplate;
    templateSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      this.plugin.settings.activeTemplate = templateSelect.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    const modeSelect = toolbar.createEl("select", { cls: "nr-mode-select" });
    this.uiModeSelect = modeSelect;
    modeSelect.createEl("option", { text: "长文 3:5", value: "long" });
    modeSelect.createEl("option", { text: "图文 3:4", value: "card" });
    modeSelect.value = this.plugin.settings.pageMode;
    modeSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      this.plugin.settings.pageMode = modeSelect.value as "long" | "card";
      await this.plugin.saveSettings();
      await this.refresh();
    });

    const renderBtn = toolbar.createEl("button", { cls: "nr-btn nr-btn-render" });
    setIcon(renderBtn, "refresh-cw");
    renderBtn.title = "Render";
    renderBtn.addEventListener("click", () => this.refresh());

    const exportBtn = toolbar.createEl("button", { cls: "nr-btn nr-btn-export" });
    setIcon(exportBtn, "download");
    exportBtn.title = "Export ZIP";
    exportBtn.addEventListener("click", () => this.handleExport());

    // Lock config button
    this.lockBtn = toolbar.createEl("button", { cls: "nr-btn nr-btn-lock" });
    this.lockBtn.title = "锁定渲染配置到笔记 / 再次点击解锁";
    setIcon(this.lockBtn, "lock");
    this.lockBtn.addEventListener("click", () => this.handleLockConfig());

    // Font controls row
    const fontBar = contentEl.createDiv("nr-font-bar");

    // Font size: - [value] +
    const sizeDown = fontBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const sizeLabel = fontBar.createDiv({ cls: "nr-font-size-label", text: `${this.plugin.settings.fontSize}px` });
    this.uiSizeLabel = sizeLabel;
    const sizeUp = fontBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });

    sizeDown.addEventListener("click", async () => {
      this.plugin.settings.fontSize = Math.max(24, this.plugin.settings.fontSize - 2);
      sizeLabel.textContent = `${this.plugin.settings.fontSize}px`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    sizeUp.addEventListener("click", async () => {
      this.plugin.settings.fontSize = Math.min(72, this.plugin.settings.fontSize + 2);
      sizeLabel.textContent = `${this.plugin.settings.fontSize}px`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Font family select
    const fontSelect = fontBar.createEl("select", { cls: "nr-font-select" });
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
      this.plugin.settings.fontFamily = fontSelect.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // ── Cover controls row ──
    const coverBar = contentEl.createDiv("nr-font-bar");

    // Cover font
    coverBar.createEl("span", { cls: "nr-font-size-label", text: "封面" });
    const coverFontSelect = coverBar.createEl("select", { cls: "nr-font-select" });
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
      this.plugin.settings.coverFontFamily = coverFontSelect.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Cover font color
    const colorInput = coverBar.createEl("input", { cls: "nr-color-input", type: "color" });
    colorInput.value = this.plugin.settings.coverFontColor || "#e07c5a";
    colorInput.title = "封面文字颜色";
    colorInput.addEventListener("input", async () => {
      this.plugin.settings.coverFontColor = colorInput.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    const colorReset = coverBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "默认色" });
    colorReset.addEventListener("click", async () => {
      this.plugin.settings.coverFontColor = "";
      colorInput.value = "#e07c5a";
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // ── Cover typography row ──
    const coverTypoBar = contentEl.createDiv("nr-font-bar");

    // Cover font scale: - [value] +
    const scaleDown = coverTypoBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const scaleLabel = coverTypoBar.createDiv({ cls: "nr-font-size-label", text: `${this.plugin.settings.coverFontScale}%` });
    this.uiScaleLabel = scaleLabel;
    const scaleUp = coverTypoBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    scaleDown.addEventListener("click", async () => {
      this.plugin.settings.coverFontScale = Math.max(50, this.plugin.settings.coverFontScale - 10);
      scaleLabel.textContent = `${this.plugin.settings.coverFontScale}%`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    scaleUp.addEventListener("click", async () => {
      this.plugin.settings.coverFontScale = Math.min(300, this.plugin.settings.coverFontScale + 10);
      scaleLabel.textContent = `${this.plugin.settings.coverFontScale}%`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Cover letter spacing: - [value] +
    const lsDown = coverTypoBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const lsLabel = coverTypoBar.createDiv({ cls: "nr-font-size-label", text: `间距${this.plugin.settings.coverLetterSpacing}` });
    this.uiLsLabel = lsLabel;
    const lsUp = coverTypoBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    lsDown.addEventListener("click", async () => {
      this.plugin.settings.coverLetterSpacing = Math.max(-5, this.plugin.settings.coverLetterSpacing - 1);
      lsLabel.textContent = `间距${this.plugin.settings.coverLetterSpacing}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    lsUp.addEventListener("click", async () => {
      this.plugin.settings.coverLetterSpacing = Math.min(30, this.plugin.settings.coverLetterSpacing + 1);
      lsLabel.textContent = `间距${this.plugin.settings.coverLetterSpacing}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Cover line height: - [value] +
    const lhDown = coverTypoBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const lhLabel = coverTypoBar.createDiv({ cls: "nr-font-size-label", text: `行高${(this.plugin.settings.coverLineHeight / 10).toFixed(1)}` });
    this.uiLhLabel = lhLabel;
    const lhUp = coverTypoBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    lhDown.addEventListener("click", async () => {
      this.plugin.settings.coverLineHeight = Math.max(8, this.plugin.settings.coverLineHeight - 1);
      lhLabel.textContent = `行高${(this.plugin.settings.coverLineHeight / 10).toFixed(1)}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    lhUp.addEventListener("click", async () => {
      this.plugin.settings.coverLineHeight = Math.min(25, this.plugin.settings.coverLineHeight + 1);
      lhLabel.textContent = `行高${(this.plugin.settings.coverLineHeight / 10).toFixed(1)}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // ── Cover offset row ──
    const offsetBar = contentEl.createDiv("nr-font-bar");

    const overlayToggle = offsetBar.createEl("button", {
      cls: `nr-btn nr-btn-sm${this.plugin.settings.coverOverlay ? " nr-btn-active" : ""}`,
      text: "遮罩",
    });
    this.uiOverlayToggle = overlayToggle;
    overlayToggle.addEventListener("click", async () => {
      if (this.syncing) return;
      this.plugin.settings.coverOverlay = !this.plugin.settings.coverOverlay;
      overlayToggle.classList.toggle("nr-btn-active", this.plugin.settings.coverOverlay);
      await this.plugin.saveSettings();
      await this.refresh();
    });

    const oxDown = offsetBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const oxLabel = offsetBar.createDiv({ cls: "nr-font-size-label", text: `X${this.plugin.settings.coverOffsetX}%` });
    this.uiOxLabel = oxLabel;
    const oxUp = offsetBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    oxDown.addEventListener("click", async () => {
      if (this.syncing) return;
      this.plugin.settings.coverOffsetX = Math.max(-50, this.plugin.settings.coverOffsetX - 1);
      oxLabel.textContent = `X${this.plugin.settings.coverOffsetX}%`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    oxUp.addEventListener("click", async () => {
      if (this.syncing) return;
      this.plugin.settings.coverOffsetX = Math.min(50, this.plugin.settings.coverOffsetX + 1);
      oxLabel.textContent = `X${this.plugin.settings.coverOffsetX}%`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    const oyDown = offsetBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const oyLabel = offsetBar.createDiv({ cls: "nr-font-size-label", text: `Y${this.plugin.settings.coverOffsetY}%` });
    this.uiOyLabel = oyLabel;
    const oyUp = offsetBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    oyDown.addEventListener("click", async () => {
      if (this.syncing) return;
      this.plugin.settings.coverOffsetY = Math.max(-50, this.plugin.settings.coverOffsetY - 1);
      oyLabel.textContent = `Y${this.plugin.settings.coverOffsetY}%`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    oyUp.addEventListener("click", async () => {
      if (this.syncing) return;
      this.plugin.settings.coverOffsetY = Math.min(50, this.plugin.settings.coverOffsetY + 1);
      oyLabel.textContent = `Y${this.plugin.settings.coverOffsetY}%`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // ── Stroke controls row ──
    const strokeBar = contentEl.createDiv("nr-font-bar");

    // Stroke style
    const strokeStyleSelect = strokeBar.createEl("select", { cls: "nr-font-select" });
    this.uiStrokeStyleSelect = strokeStyleSelect;
    [
      { label: "描边", value: "stroke" },
      { label: "双层", value: "double" },
      { label: "发光", value: "glow" },
      { label: "无描边", value: "none" },
    ].forEach((s) => strokeStyleSelect.createEl("option", { text: s.label, value: s.value }));
    strokeStyleSelect.value = this.plugin.settings.coverStrokeStyle;
    strokeStyleSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      this.plugin.settings.coverStrokeStyle = strokeStyleSelect.value as any;
      // Set default percent for each style
      const defaults: Record<string, number> = { stroke: 20, double: 5, glow: 6, none: 0 };
      this.plugin.settings.coverStrokePercent = defaults[strokeStyleSelect.value] ?? 8;
      strokeLabel.textContent = `${this.plugin.settings.coverStrokePercent}%`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Stroke percent: − [粗X] +
    const strokeDown = strokeBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const strokeLabel = strokeBar.createDiv({ cls: "nr-font-size-label", text: `粗${this.plugin.settings.coverStrokePercent}` });
    this.uiStrokeLabel = strokeLabel;
    const strokeUp = strokeBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    strokeDown.addEventListener("click", async () => {
      this.plugin.settings.coverStrokePercent = Math.max(0, this.plugin.settings.coverStrokePercent - 1);
      strokeLabel.textContent = `粗${this.plugin.settings.coverStrokePercent}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    strokeUp.addEventListener("click", async () => {
      this.plugin.settings.coverStrokePercent = Math.min(100, this.plugin.settings.coverStrokePercent + 1);
      strokeLabel.textContent = `粗${this.plugin.settings.coverStrokePercent}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Stroke opacity: − [透X] +  (visible for stroke/double/glow)
    const opDown = strokeBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const opLabel = strokeBar.createDiv({ cls: "nr-font-size-label", text: `透${this.plugin.settings.coverStrokeOpacity}` });
    this.uiOpLabel = opLabel;
    const opUp = strokeBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    opDown.addEventListener("click", async () => {
      this.plugin.settings.coverStrokeOpacity = Math.max(0, this.plugin.settings.coverStrokeOpacity - 10);
      opLabel.textContent = `透${this.plugin.settings.coverStrokeOpacity}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    opUp.addEventListener("click", async () => {
      this.plugin.settings.coverStrokeOpacity = Math.min(100, this.plugin.settings.coverStrokeOpacity + 10);
      opLabel.textContent = `透${this.plugin.settings.coverStrokeOpacity}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Glow size: − [光X] +  (visible for double/glow only)
    const glowDown = strokeBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const glowLabel = strokeBar.createDiv({ cls: "nr-font-size-label", text: `光${this.plugin.settings.coverGlowSize}` });
    this.uiGlowLabel = glowLabel;
    const glowUp = strokeBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    glowDown.addEventListener("click", async () => {
      this.plugin.settings.coverGlowSize = Math.max(0, this.plugin.settings.coverGlowSize - 10);
      glowLabel.textContent = `光${this.plugin.settings.coverGlowSize}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    glowUp.addEventListener("click", async () => {
      this.plugin.settings.coverGlowSize = Math.min(200, this.plugin.settings.coverGlowSize + 10);
      glowLabel.textContent = `光${this.plugin.settings.coverGlowSize}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Show/hide stroke params based on mode
    const strokeParamEls = [strokeDown, strokeLabel, strokeUp];
    const opParamEls = [opDown, opLabel, opUp];
    const glowParamEls = [glowDown, glowLabel, glowUp];
    const updateStrokeParamsVisibility = () => {
      const mode = strokeStyleSelect.value;
      const hasStroke = mode !== "none";
      const hasGlow = mode === "double" || mode === "glow";
      strokeParamEls.forEach(el => (el as HTMLElement).style.display = hasStroke ? "" : "none");
      opParamEls.forEach(el => (el as HTMLElement).style.display = hasStroke ? "" : "none");
      glowParamEls.forEach(el => (el as HTMLElement).style.display = hasGlow ? "" : "none");
    };
    updateStrokeParamsVisibility();
    strokeStyleSelect.addEventListener("change", updateStrokeParamsVisibility);

    // ── Banner controls row (independent toggle, like shadow row) ──
    const bannerBar = contentEl.createDiv("nr-font-bar");

    const bannerToggle = bannerBar.createEl("button", {
      cls: `nr-btn nr-btn-sm${this.plugin.settings.coverBanner ? " nr-btn-active" : ""}`,
      text: "色带",
    });
    this.uiBannerToggle = bannerToggle;

    // Parse rgba to hex for color picker
    const parseColor = (c: string) => {
      if (c.startsWith("#")) return c;
      const m = c.match(/[\d.]+/g);
      if (!m) return "#000000";
      return "#" + [0,1,2].map(i => Math.round(Number(m[i])).toString(16).padStart(2, "0")).join("");
    };
    const bannerColorInput = bannerBar.createEl("input", { type: "color" });
    bannerColorInput.value = parseColor(this.plugin.settings.coverBannerColor);

    const bannerAlpha = Math.round((parseFloat((this.plugin.settings.coverBannerColor.match(/[\d.]+/g) || [])[3] ?? "0.5") * 100));
    let currentAlpha = bannerAlpha / 100;

    const bannerAlphaDown = bannerBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const bannerAlphaLabel = bannerBar.createDiv({ cls: "nr-font-size-label", text: `${bannerAlpha}%` });
    const bannerAlphaUp = bannerBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });

    const skewDown = bannerBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const skewLabel = bannerBar.createDiv({ cls: "nr-font-size-label", text: `斜${this.plugin.settings.coverBannerSkew}` });
    const skewUp = bannerBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });

    // Hide params when banner is off
    const bannerParamEls = [bannerColorInput, bannerAlphaDown, bannerAlphaLabel, bannerAlphaUp, skewDown, skewLabel, skewUp];
    const setBannerParamsVisible = (v: boolean) => bannerParamEls.forEach(el => (el as HTMLElement).style.display = v ? "" : "none");
    setBannerParamsVisible(this.plugin.settings.coverBanner);

    bannerToggle.addEventListener("click", async () => {
      this.plugin.settings.coverBanner = !this.plugin.settings.coverBanner;
      bannerToggle.classList.toggle("nr-btn-active", this.plugin.settings.coverBanner);
      setBannerParamsVisible(this.plugin.settings.coverBanner);
      await this.plugin.saveSettings();
      await this.refresh();
    });

    const updateBannerColor = async () => {
      const hex = bannerColorInput.value;
      const r = parseInt(hex.slice(1,3), 16);
      const g = parseInt(hex.slice(3,5), 16);
      const b = parseInt(hex.slice(5,7), 16);
      this.plugin.settings.coverBannerColor = `rgba(${r},${g},${b},${currentAlpha})`;
      bannerAlphaLabel.textContent = `${Math.round(currentAlpha * 100)}%`;
      await this.plugin.saveSettings();
      await this.refresh();
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
      this.plugin.settings.coverBannerSkew = Math.max(0, this.plugin.settings.coverBannerSkew - 1);
      skewLabel.textContent = `斜${this.plugin.settings.coverBannerSkew}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    skewUp.addEventListener("click", async () => {
      this.plugin.settings.coverBannerSkew = Math.min(20, this.plugin.settings.coverBannerSkew + 1);
      skewLabel.textContent = `斜${this.plugin.settings.coverBannerSkew}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });


    // ── Shadow controls row ──
    const shadowBar = contentEl.createDiv("nr-font-bar");

    const shadowToggle = shadowBar.createEl("button", {
      cls: `nr-btn nr-btn-sm${this.plugin.settings.coverShadow ? " nr-btn-active" : ""}`,
      text: "投影",
    });
    this.uiShadowToggle = shadowToggle;
    shadowToggle.addEventListener("click", async () => {
      this.plugin.settings.coverShadow = !this.plugin.settings.coverShadow;
      shadowToggle.classList.toggle("nr-btn-active", this.plugin.settings.coverShadow);
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Shadow blur: - [value] +
    const blurDown = shadowBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const blurLabel = shadowBar.createDiv({ cls: "nr-font-size-label", text: `模糊${this.plugin.settings.coverShadowBlur}` });
    this.uiBlurLabel = blurLabel;
    const blurUp = shadowBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    blurDown.addEventListener("click", async () => {
      this.plugin.settings.coverShadowBlur = this.plugin.settings.coverShadowBlur - 5;
      blurLabel.textContent = `模糊${this.plugin.settings.coverShadowBlur}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    blurUp.addEventListener("click", async () => {
      this.plugin.settings.coverShadowBlur = this.plugin.settings.coverShadowBlur + 5;
      blurLabel.textContent = `模糊${this.plugin.settings.coverShadowBlur}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Shadow offset X: - [value] +
    const offXDown = shadowBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const offXLabel = shadowBar.createDiv({ cls: "nr-font-size-label", text: `X${this.plugin.settings.coverShadowOffsetX}` });
    const offXUp = shadowBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    offXDown.addEventListener("click", async () => {
      this.plugin.settings.coverShadowOffsetX = this.plugin.settings.coverShadowOffsetX - 5;
      offXLabel.textContent = `X${this.plugin.settings.coverShadowOffsetX}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    offXUp.addEventListener("click", async () => {
      this.plugin.settings.coverShadowOffsetX = this.plugin.settings.coverShadowOffsetX + 5;
      offXLabel.textContent = `X${this.plugin.settings.coverShadowOffsetX}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Shadow offset Y: - [value] +
    const offYDown = shadowBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const offYLabel = shadowBar.createDiv({ cls: "nr-font-size-label", text: `Y${this.plugin.settings.coverShadowOffsetY}` });
    const offYUp = shadowBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });
    offYDown.addEventListener("click", async () => {
      this.plugin.settings.coverShadowOffsetY = this.plugin.settings.coverShadowOffsetY - 5;
      offYLabel.textContent = `Y${this.plugin.settings.coverShadowOffsetY}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    offYUp.addEventListener("click", async () => {
      this.plugin.settings.coverShadowOffsetY = this.plugin.settings.coverShadowOffsetY + 5;
      offYLabel.textContent = `Y${this.plugin.settings.coverShadowOffsetY}`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Preview area
    this.previewContainer = contentEl.createDiv("nr-preview-area");
    this.pageDisplay = this.previewContainer.createDiv("nr-page-display");

    // Navigation
    const nav = contentEl.createDiv("nr-nav");
    const prevBtn = nav.createEl("button", { cls: "nr-nav-btn" });
    setIcon(prevBtn, "chevron-left");
    prevBtn.addEventListener("click", () => this.goPage(-1));

    this.pageIndicator = nav.createDiv("nr-page-indicator");

    const nextBtn = nav.createEl("button", { cls: "nr-nav-btn" });
    setIcon(nextBtn, "chevron-right");
    nextBtn.addEventListener("click", () => this.goPage(1));

    // ResizeObserver — rescale on sidebar width change
    this.resizeObserver = new ResizeObserver(() => {
      this.rescale();
    });
    this.resizeObserver.observe(this.previewContainer);

    // Watch for file changes — auto-refresh when the current note is modified
    const debouncedRefresh = debounce(() => this.refresh(), 500, true);

    this.fileChangeHandler = (file: TAbstractFile) => {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && file.path === activeFile.path) {
        debouncedRefresh();
      }
    };
    this.app.vault.on("modify", this.fileChangeHandler);

    // Watch for active file change — refresh when switching notes
    this.activeFileHandler = () => {
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
    const merged: NoteRendererSettings = Object.assign({}, this.plugin.settings);
    if (noteConfig) {
      for (const [key, value] of Object.entries(noteConfig)) {
        if (key in merged && value !== undefined && value !== null) {
          (merged as Record<string, unknown>)[key] = value;
        }
      }
    }

    // Update lock button appearance
    if (this.lockBtn) {
      if (noteConfig) {
        this.lockBtn.classList.add("nr-btn-active");
        this.lockBtn.title = "已锁定（点击解锁）";
        setIcon(this.lockBtn, "lock");
      } else {
        this.lockBtn.classList.remove("nr-btn-active");
        this.lockBtn.title = "锁定渲染配置到笔记 / 再次点击解锁";
        setIcon(this.lockBtn, "unlock");
      }
    }

    // Sync UI controls to reflect the effective (possibly overridden) settings
    if (noteConfig) {
      this.syncUiToSettings(merged);
    }

    this.effectivePageMode = merged.pageMode;
    const templateCss = await this.plugin.loadTemplate(merged.activeTemplate);

    this.rendered?.cleanup();
    this.rendered = await renderNote(
      this.app,
      markdown,
      file.path,
      templateCss,
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

  /** Sync UI control display values to reflect effective settings (e.g. after renderer_config override). */
  private syncUiToSettings(s: NoteRendererSettings): void {
    this.syncing = true;
    if (this.uiTemplateSelect) this.uiTemplateSelect.value = s.activeTemplate;
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
    this.syncing = false;
  }

  /** Write current UI settings as renderer_config into the active note, or remove if already locked. */
  private async handleLockConfig(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("No active markdown file");
      return;
    }

    const markdown = await this.app.vault.read(file);
    const noteConfig = parseRendererConfig(markdown);

    if (noteConfig) {
      // Already locked — remove renderer_config section
      const newContent = removeRendererConfigSection(markdown);
      await this.app.vault.modify(file, newContent);
      new Notice("已解锁：renderer_config 已移除");
    } else {
      // Lock current settings into note
      const s = this.plugin.settings;
      const configJson = JSON.stringify({
        activeTemplate: s.activeTemplate,
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
      new Notice("已锁定：renderer_config 已写入笔记");
    }
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
    const template = this.plugin.settings.activeTemplate;
    const mode = this.plugin.settings.pageMode === "card" ? "3-4" : "3-5";
    const zipName = `${baseName}_${template}_${mode}`;

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
