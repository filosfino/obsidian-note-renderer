import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  TAbstractFile,
  Notice,
  Modal,
  Menu,
  Setting,
  setIcon,
  debounce,
} from "obsidian";
import { VIEW_TYPE, PAGE_WIDTH, PAGE_HEIGHTS } from "./constants";
import { renderNote, RenderedPages } from "./renderer";
import { exportPages, exportSinglePage } from "./exporter";
import { parseRendererConfig } from "./parser";
import { extractRenderOptions, RENDER_KEYS, INTERNAL_TO_NOTE_KEY, toNoteConfigKeys } from "./schema";
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
  private coverCropOverlay: HTMLElement | null = null;
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
  private uiModeBtns: { long: HTMLElement; card: HTMLElement } | null = null;
  private uiSizeInput: HTMLInputElement | null = null;
  private uiFontSelect: HTMLSelectElement | null = null;
  private uiCoverFontSelect: HTMLSelectElement | null = null;
  private uiScaleInput: HTMLInputElement | null = null;
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
  private uiAlignBtns: { left: HTMLElement; center: HTMLElement; right: HTMLElement } | null = null;
  private _effectParamRows: Record<string, HTMLElement> = {};

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

    // ── Top bar: 预设 (compact) ──
    const presetBar = contentEl.createDiv("nr-top-bar");
    presetBar.createEl("span", { cls: "nr-row-label", text: "预设" });
    const presetSelect = presetBar.createEl("select", { cls: "dropdown" });
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

    const presetSaveBtn = presetBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "保存" });
    presetSaveBtn.style.width = "auto";
    presetSaveBtn.style.padding = "0 8px";
    presetSaveBtn.title = "保存当前配置为预设";
    presetSaveBtn.addEventListener("click", () => {
      new InputModal(this.app, "保存预设", this.plugin.settings.activePreset || "", async (name) => {
        if (!name) return;
        const preset: Record<string, unknown> = {};
        for (const key of PRESET_KEYS) {
          preset[key] = (this.effective as Record<string, unknown>)[key];
        }
        this.plugin.settings.presets[name] = preset as any;
        this.plugin.settings.activePreset = name;
        await this.plugin.saveSettings();
        this.rebuildPresetOptions();
        new Notice(`预设「${name}」已保存`);
      }).open();
    });

    const presetDelBtn = presetBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "删除" });
    presetDelBtn.style.width = "auto";
    presetDelBtn.style.padding = "0 8px";
    presetDelBtn.title = "删除当前预设";
    presetDelBtn.addEventListener("click", () => {
      const name = this.plugin.settings.activePreset;
      if (!name) { new Notice("没有选中预设"); return; }
      new ConfirmModal(this.app, `删除预设「${name}」？`, async (confirmed) => {
        if (!confirmed) return;
        this.plugin.deletePreset(name);
        await this.plugin.saveSettings();
        this.rebuildPresetOptions();
        new Notice(`预设「${name}」已删除`);
        await this.refresh();
      }).open();
    });

    // ── Quick bar: 主题 + 模式 ──
    const quickBar = contentEl.createDiv("nr-quick-bar");
    quickBar.createEl("span", { cls: "nr-row-label", text: "主题" });
    const themeSelect = quickBar.createEl("select", { cls: "dropdown" });
    this.uiThemeSelect = themeSelect;
    this.plugin.getThemeNames().forEach((name) => {
      themeSelect.createEl("option", { text: name, value: name });
    });
    themeSelect.value = this.plugin.settings.activeTheme;
    themeSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      await this.updateSetting("activeTheme", themeSelect.value);
    });

    // Mode toggle buttons (mutually exclusive, pushed right)
    quickBar.createDiv().style.flex = "1";
    const modeBtn35 = quickBar.createEl("button", {
      cls: `nr-btn nr-btn-sm${this.plugin.settings.pageMode === "long" ? " nr-btn-active" : ""}`,
      text: "3:5",
    });
    modeBtn35.style.width = "auto";
    modeBtn35.style.padding = "0 8px";
    const modeBtn34 = quickBar.createEl("button", {
      cls: `nr-btn nr-btn-sm${this.plugin.settings.pageMode === "card" ? " nr-btn-active" : ""}`,
      text: "3:4",
    });
    modeBtn34.style.width = "auto";
    modeBtn34.style.padding = "0 8px";

    const setMode = async (mode: "long" | "card") => {
      if (this.syncing) return;
      modeBtn35.classList.toggle("nr-btn-active", mode === "long");
      modeBtn34.classList.toggle("nr-btn-active", mode === "card");
      await this.updateSetting("pageMode", mode);
    };
    modeBtn35.addEventListener("click", () => setMode("long"));
    modeBtn34.addEventListener("click", () => setMode("card"));

    this.uiModeBtns = { long: modeBtn35, card: modeBtn34 };

    // Keep a hidden select for syncUI compatibility
    const modeSelect = document.createElement("select");
    this.uiModeSelect = modeSelect;
    modeSelect.style.display = "none";
    modeSelect.createEl("option", { text: "长文 3:5", value: "long" });
    modeSelect.createEl("option", { text: "图文 3:4", value: "card" });
    modeSelect.value = this.plugin.settings.pageMode;

    // ── Cover section (wraps two accordion sections) ──
    this.coverSection = contentEl.createDiv("nr-cover-section");

    // ── Section: 封面文字 (collapsible) ──
    const coverTextSection = this.coverSection.createDiv("nr-section open");
    const coverTextHead = coverTextSection.createDiv("nr-section-head");
    coverTextHead.createEl("span", { cls: "nr-section-chevron", text: "▶" });
    coverTextHead.createEl("span", { cls: "nr-section-title", text: "封面文字" });

    // Header inline controls: font select + scale input + align icons
    const coverHeadControls = coverTextHead.createDiv("nr-header-controls");

    const coverFontSelect = coverHeadControls.createEl("select", { cls: "dropdown" });
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
    coverFontSelect.addEventListener("click", (e) => e.stopPropagation());
    coverFontSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      await this.updateSetting("coverFontFamily", coverFontSelect.value);
    });

    const scaleInput = coverHeadControls.createEl("input", { cls: "nr-size-input", type: "text" });
    scaleInput.value = String(this.plugin.settings.coverFontScale);
    this.uiScaleInput = scaleInput;
    scaleInput.addEventListener("click", (e) => e.stopPropagation());
    const applyScale = async () => {
      if (this.syncing) return;
      const val = Math.max(50, Math.min(300, parseInt(scaleInput.value) || 90));
      scaleInput.value = String(val);
      await this.updateSetting("coverFontScale", val);
    };
    scaleInput.addEventListener("blur", applyScale);
    scaleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyScale(); } });
    scaleInput.addEventListener("wheel", (e) => {
      if (document.activeElement !== scaleInput) return;
      e.preventDefault();
      const cur = parseInt(scaleInput.value) || 90;
      const val = Math.max(50, Math.min(300, cur + (e.deltaY < 0 ? 10 : -10)));
      scaleInput.value = String(val);
      this.updateSetting("coverFontScale", val);
    }, { passive: false });
    coverHeadControls.createEl("span", { cls: "nr-size-unit", text: "%" });

    // Align buttons (independent)
    const alignDefs: { key: "left" | "center" | "right"; title: string; icon: string }[] = [
      { key: "left",   title: "左对齐", icon: "align-left" },
      { key: "center", title: "居中",   icon: "align-center" },
      { key: "right",  title: "右对齐", icon: "align-right" },
    ];
    const alignBtns: Record<string, HTMLElement> = {};
    alignDefs.forEach((def) => {
      const btn = coverHeadControls.createEl("button", {
        cls: `nr-btn nr-btn-sm${(this.plugin.settings.coverTextAlign ?? "left") === def.key ? " nr-btn-active" : ""}`,
      });
      btn.title = def.title;
      setIcon(btn, def.icon);
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (this.syncing) return;
        Object.values(alignBtns).forEach((b) => b.classList.remove("nr-btn-active"));
        btn.classList.add("nr-btn-active");
        await this.updateSetting("coverTextAlign", def.key);
      });
      alignBtns[def.key] = btn;
    });
    this.uiAlignBtns = alignBtns as any;

    // Toggle section on head click (but not on controls)
    const toggleSection = (target: HTMLElement) => {
      const opening = !target.classList.contains("open");
      if (opening) {
        target.parentElement?.querySelectorAll(".nr-section.open").forEach((s) => {
          if (s !== target) s.classList.remove("open");
        });
      }
      target.classList.toggle("open");
    };
    coverTextHead.addEventListener("click", () => toggleSection(coverTextSection));

    // ── Section body ──
    const coverTextBody = coverTextSection.createDiv("nr-section-body");

    // Text effect chips: 描边 / 色带 / 投影
    this.lastStrokeStyle = this.plugin.settings.coverStrokeStyle !== "none" ? this.plugin.settings.coverStrokeStyle : "stroke";
    const strokeEnabled = this.plugin.settings.coverStrokeStyle !== "none";

    const textEffectRow = coverTextBody.createDiv("nr-row");
    textEffectRow.createEl("span", { cls: "nr-row-label", text: "效果" });
    const strokeToggle = textEffectRow.createEl("span", { cls: `nr-chip${strokeEnabled ? " active" : ""}`, text: "描边" });
    this.uiStrokeToggle = strokeToggle;
    const bannerToggle = textEffectRow.createEl("span", { cls: `nr-chip${this.plugin.settings.coverBanner ? " active" : ""}`, text: "色带" });
    this.uiBannerToggle = bannerToggle;
    const shadowToggle = textEffectRow.createEl("span", { cls: `nr-chip${this.plugin.settings.coverShadow ? " active" : ""}`, text: "投影" });
    this.uiShadowToggle = shadowToggle;

    // Combined row: color + weight + spacing + line height
    const styleRow = coverTextBody.createDiv("nr-row");
    styleRow.createEl("span", { cls: "nr-row-label", text: "样式" });

    const colorInput = styleRow.createEl("input", { cls: "nr-color-dot", type: "color" });
    colorInput.value = this.plugin.settings.coverFontColor || "#e07c5a";
    colorInput.title = "封面文字颜色（双击重置为主题默认）";
    colorInput.addEventListener("input", async () => {
      await this.updateSetting("coverFontColor", colorInput.value);
    });
    colorInput.addEventListener("dblclick", async (e) => {
      e.preventDefault();
      if (this.syncing) return;
      colorInput.value = "#e07c5a";
      await this.updateSetting("coverFontColor", "");
    });

    const weightSelect = styleRow.createEl("select", { cls: "dropdown" });
    weightSelect.style.width = "72px";
    weightSelect.style.flex = "none";
    [
      { label: "极细 100", value: "100" },
      { label: "细 200", value: "200" },
      { label: "轻 300", value: "300" },
      { label: "常规 400", value: "400" },
      { label: "中 500", value: "500" },
      { label: "半粗 600", value: "600" },
      { label: "粗 700", value: "700" },
      { label: "特粗 800", value: "800" },
      { label: "极粗 900", value: "900" },
    ].forEach((w) => weightSelect.createEl("option", { text: w.label, value: w.value }));
    weightSelect.value = String(this.plugin.settings.coverFontWeight ?? 800);
    weightSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      await this.updateSetting("coverFontWeight", parseInt(weightSelect.value));
    });

    // Helper: create labeled input field with scroll-wheel support
    const makeField = (parent: HTMLElement, label: string, value: string, opts: { min: number; max: number; step?: number; unit?: string; transform?: (v: number) => string; parse?: (v: string) => number }, onUpdate: (val: number) => Promise<void>) => {
      const group = parent.createDiv("nr-field");
      if (label) group.createEl("span", { cls: "nr-field-label", text: label });
      const input = group.createEl("input", { cls: "nr-field-input", type: "text" });
      input.value = value;
      if (opts.unit) group.createEl("span", { cls: "nr-field-unit", text: opts.unit });
      const step = opts.step ?? 1;
      const parse = opts.parse ?? ((v: string) => parseFloat(v) || 0);
      const transform = opts.transform ?? String;
      const applyVal = async (raw: number) => {
        if (this.syncing) return;
        const val = Math.max(opts.min, Math.min(opts.max, raw));
        input.value = transform(val);
        await onUpdate(val);
      };
      const apply = () => applyVal(parse(input.value));
      input.addEventListener("blur", apply);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } });
      // Scroll wheel: adjust value when input is focused
      input.addEventListener("wheel", (e) => {
        if (document.activeElement !== input) return;
        e.preventDefault();
        const current = parse(input.value);
        const delta = e.deltaY < 0 ? step : -step;
        applyVal(current + delta);
      }, { passive: false });
      return input;
    };

    const lsInput = makeField(styleRow, "间距", String(this.plugin.settings.coverLetterSpacing),
      { min: -5, max: 30 },
      (val) => this.updateSetting("coverLetterSpacing", val));
    this.uiLsLabel = lsInput as any;

    const lhInput = makeField(styleRow, "行高", (this.plugin.settings.coverLineHeight / 10).toFixed(1),
      { min: 0.8, max: 2.5, step: 0.1, transform: (v) => v.toFixed(1) },
      (val) => this.updateSetting("coverLineHeight", Math.round(val * 10)));
    this.uiLhLabel = lhInput as any;

    // Position row
    const posRow = coverTextBody.createDiv("nr-row");
    posRow.createEl("span", { cls: "nr-row-label", text: "位置" });

    const oxInput = makeField(posRow, "X", String(this.plugin.settings.coverOffsetX),
      { min: -50, max: 50, unit: "%" },
      (val) => this.updateSetting("coverOffsetX", val));
    this.uiOxLabel = oxInput as any;

    const oyInput = makeField(posRow, "Y", String(this.plugin.settings.coverOffsetY),
      { min: -50, max: 50, unit: "%" },
      (val) => this.updateSetting("coverOffsetY", val))
    this.uiOyLabel = oyInput as any;

    // ── Stroke sub-params (in coverTextBody) ──
    const strokeParamsRow = coverTextBody.createDiv("nr-row");
    this.strokeParamsRow = strokeParamsRow;
    strokeParamsRow.createEl("span", { cls: "nr-row-label", text: "描边" });
    strokeParamsRow.style.display = strokeEnabled ? "" : "none";

    const strokeStyleSelect = strokeParamsRow.createEl("select", { cls: "dropdown" });
    strokeStyleSelect.style.width = "72px";
    strokeStyleSelect.style.flex = "none";
    this.uiStrokeStyleSelect = strokeStyleSelect;
    [
      { label: "描边", value: "stroke" },
      { label: "双层", value: "double" },
      { label: "发光", value: "glow" },
    ].forEach((s) => strokeStyleSelect.createEl("option", { text: s.label, value: s.value }));
    strokeStyleSelect.value = strokeEnabled ? this.plugin.settings.coverStrokeStyle : this.lastStrokeStyle;

    const strokeInput = makeField(strokeParamsRow, "粗", String(this.plugin.settings.coverStrokePercent),
      { min: 0, max: 100 },
      (val) => this.updateSetting("coverStrokePercent", val));
    this.uiStrokeLabel = strokeInput as any;

    const opInput = makeField(strokeParamsRow, "透", String(this.plugin.settings.coverStrokeOpacity),
      { min: 0, max: 100 },
      (val) => this.updateSetting("coverStrokeOpacity", val));
    this.uiOpLabel = opInput as any;

    const glowField = strokeParamsRow.createDiv("nr-field");
    glowField.createEl("span", { cls: "nr-field-label", text: "光" });
    const glowInput = glowField.createEl("input", { cls: "nr-field-input", type: "text" });
    glowInput.value = String(this.plugin.settings.coverGlowSize);
    this.uiGlowLabel = glowInput as any;
    const applyGlow = async () => {
      if (this.syncing) return;
      const val = Math.max(0, Math.min(200, parseInt(glowInput.value) || 0));
      glowInput.value = String(val);
      await this.updateSetting("coverGlowSize", val);
    };
    glowInput.addEventListener("blur", applyGlow);
    glowInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyGlow(); } });

    const updateGlowVisibility = () => {
      const mode = strokeStyleSelect.value;
      const hasGlow = mode === "double" || mode === "glow";
      glowField.style.display = hasGlow ? "" : "none";
    };
    updateGlowVisibility();

    strokeStyleSelect.addEventListener("change", async () => {
      if (this.syncing) return;
      const style = strokeStyleSelect.value as any;
      this.lastStrokeStyle = style;
      const defaults: Record<string, number> = { stroke: 20, double: 5, glow: 6 };
      const newPercent = defaults[style] ?? 8;
      strokeInput.value = String(newPercent);
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

    strokeToggle.addEventListener("click", async () => {
      if (this.syncing) return;
      const currentStyle = this.effective.coverStrokeStyle;
      if (currentStyle !== "none") {
        this.lastStrokeStyle = currentStyle;
        strokeToggle.classList.remove("active");
        strokeParamsRow.style.display = "none";
        await this.updateSetting("coverStrokeStyle", "none");
      } else {
        strokeToggle.classList.add("active");
        strokeParamsRow.style.display = "";
        strokeStyleSelect.value = this.lastStrokeStyle;
        updateGlowVisibility();
        await this.updateSetting("coverStrokeStyle", this.lastStrokeStyle);
      }
    });

    // ── Banner sub-params (in coverTextBody) ──
    const bannerParamsRow = coverTextBody.createDiv("nr-row");
    this.bannerParamsRow = bannerParamsRow;
    bannerParamsRow.createEl("span", { cls: "nr-row-label", text: "色带" });
    bannerParamsRow.style.display = this.plugin.settings.coverBanner ? "" : "none";

    const parseColor = (c: string) => {
      if (c.startsWith("#")) return c;
      const m = c.match(/[\d.]+/g);
      if (!m) return "#000000";
      return "#" + [0,1,2].map(i => Math.round(Number(m[i])).toString(16).padStart(2, "0")).join("");
    };
    const bannerColorInput = bannerParamsRow.createEl("input", { cls: "nr-color-dot", type: "color" });
    bannerColorInput.value = parseColor(this.plugin.settings.coverBannerColor);

    const bannerAlpha = Math.round((parseFloat((this.plugin.settings.coverBannerColor.match(/[\d.]+/g) || [])[3] ?? "0.5") * 100));
    let currentAlpha = bannerAlpha / 100;

    makeField(bannerParamsRow, "", String(bannerAlpha),
      { min: 0, max: 100, unit: "%" },
      async (val) => { currentAlpha = val / 100; await updateBannerColor(); });

    makeField(bannerParamsRow, "斜", String(this.plugin.settings.coverBannerSkew),
      { min: 0, max: 20 },
      (val) => this.updateSetting("coverBannerSkew", val));

    bannerToggle.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = !this.effective.coverBanner;
      bannerToggle.classList.toggle("active", val);
      bannerParamsRow.style.display = val ? "" : "none";
      await this.updateSetting("coverBanner", val);
    });

    const updateBannerColor = async () => {
      const hex = bannerColorInput.value;
      const r = parseInt(hex.slice(1,3), 16);
      const g = parseInt(hex.slice(3,5), 16);
      const b = parseInt(hex.slice(5,7), 16);
      const rgba = `rgba(${r},${g},${b},${currentAlpha})`;
      await this.updateSetting("coverBannerColor", rgba);
    };
    bannerColorInput.addEventListener("input", updateBannerColor);

    // ── Shadow sub-params (in coverTextBody) ──
    const shadowParamsRow = coverTextBody.createDiv("nr-row");
    this.shadowParamsRow = shadowParamsRow;
    shadowParamsRow.createEl("span", { cls: "nr-row-label", text: "投影" });
    shadowParamsRow.style.display = this.plugin.settings.coverShadow ? "" : "none";

    shadowToggle.addEventListener("click", async () => {
      if (this.syncing) return;
      const val = !this.effective.coverShadow;
      shadowToggle.classList.toggle("active", val);
      shadowParamsRow.style.display = val ? "" : "none";
      await this.updateSetting("coverShadow", val);
    });

    const blurInput = makeField(shadowParamsRow, "模糊", String(this.plugin.settings.coverShadowBlur),
      { min: 0, max: 200 },
      (val) => this.updateSetting("coverShadowBlur", val));
    this.uiBlurLabel = blurInput as any;

    makeField(shadowParamsRow, "X", String(this.plugin.settings.coverShadowOffsetX),
      { min: -100, max: 100 },
      (val) => this.updateSetting("coverShadowOffsetX", val));

    makeField(shadowParamsRow, "Y", String(this.plugin.settings.coverShadowOffsetY),
      { min: -100, max: 100 },
      (val) => this.updateSetting("coverShadowOffsetY", val));

    // ── Section: 效果 (decorative overlays only) ──
    const effectSection = this.coverSection.createDiv("nr-section");
    const effectHead = effectSection.createDiv("nr-section-head");
    effectHead.createEl("span", { cls: "nr-section-chevron", text: "▶" });
    effectHead.createEl("span", { cls: "nr-section-title", text: "效果" });

    const effectChips = effectHead.createDiv("nr-header-chips");

    const chipToggle = (parent: HTMLElement, label: string, key: string, active: boolean) => {
      const chip = parent.createEl("span", { cls: `nr-chip${active ? " active" : ""}`, text: label });
      chip.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (this.syncing) return;
        const val = !(this.effective as any)[key];
        chip.classList.toggle("active", val);
        await this.updateSetting(key, val);
      });
      return chip;
    };

    const overlayToggle = chipToggle(effectChips, "遮罩", "coverOverlay", this.plugin.settings.coverOverlay);
    this.uiOverlayToggle = overlayToggle;
    chipToggle(effectChips, "暗角", "coverVignette", this.plugin.settings.coverVignette);
    chipToggle(effectChips, "噪点", "coverGrain", this.plugin.settings.coverGrain);
    chipToggle(effectChips, "极光", "coverAurora", this.plugin.settings.coverAurora);
    chipToggle(effectChips, "散景", "coverBokeh", this.plugin.settings.coverBokeh);
    chipToggle(effectChips, "网格", "coverGrid", this.plugin.settings.coverGrid);
    chipToggle(effectChips, "漏光", "coverLightLeak", this.plugin.settings.coverLightLeak);
    chipToggle(effectChips, "扫描线", "coverScanlines", this.plugin.settings.coverScanlines);
    chipToggle(effectChips, "网络", "coverNetwork", this.plugin.settings.coverNetwork);

    effectHead.addEventListener("click", () => toggleSection(effectSection));

    // ── Effect section body: opacity sub-params ──
    const effectBody = effectSection.createDiv("nr-section-body");

    const effectFields: { label: string; key: string; opKey: string; active: boolean; min: number; max: number; def: number }[] = [
      { label: "遮罩", key: "coverOverlay", opKey: "coverOverlayOpacity", active: this.plugin.settings.coverOverlay, min: 0, max: 100, def: 55 },
      { label: "暗角", key: "coverVignette", opKey: "coverVignetteOpacity", active: this.plugin.settings.coverVignette, min: 0, max: 100, def: 50 },
      { label: "噪点", key: "coverGrain", opKey: "coverGrainOpacity", active: this.plugin.settings.coverGrain, min: 1, max: 50, def: 8 },
      { label: "极光", key: "coverAurora", opKey: "coverAuroraOpacity", active: this.plugin.settings.coverAurora, min: 5, max: 80, def: 30 },
      { label: "散景", key: "coverBokeh", opKey: "coverBokehOpacity", active: this.plugin.settings.coverBokeh, min: 1, max: 50, def: 12 },
      { label: "网格", key: "coverGrid", opKey: "coverGridOpacity", active: this.plugin.settings.coverGrid, min: 1, max: 30, def: 6 },
      { label: "漏光", key: "coverLightLeak", opKey: "coverLightLeakOpacity", active: this.plugin.settings.coverLightLeak, min: 5, max: 80, def: 25 },
      { label: "扫描线", key: "coverScanlines", opKey: "coverScanlinesOpacity", active: this.plugin.settings.coverScanlines, min: 1, max: 30, def: 8 },
      { label: "网络", key: "coverNetwork", opKey: "coverNetworkOpacity", active: this.plugin.settings.coverNetwork, min: 5, max: 50, def: 15 },
    ];

    const effectParamRows: Record<string, HTMLElement> = {};
    for (const ef of effectFields) {
      const row = effectBody.createDiv("nr-row");
      row.createEl("span", { cls: "nr-row-label", text: ef.label });
      row.style.display = ef.active ? "" : "none";
      effectParamRows[ef.key] = row;
      makeField(row, "强度", String((this.effective as any)[ef.opKey] ?? ef.def),
        { min: ef.min, max: ef.max, unit: "%" },
        (val) => this.updateSetting(ef.opKey, val));
      // Wire chip toggle to show/hide this row
      const chips = effectChips.querySelectorAll(".nr-chip");
      for (const chip of chips) {
        if (chip.textContent === ef.label) {
          chip.addEventListener("click", () => {
            row.style.display = chip.classList.contains("active") ? "" : "none";
          });
        }
      }
    }
    this._effectParamRows = effectParamRows;

    // ── Body section: flat row (no accordion) ──
    this.bodySection = contentEl.createDiv("nr-flat-row");
    this.bodySection.createEl("span", { cls: "nr-section-title", text: "正文" });

    const bodyControls = this.bodySection.createDiv("nr-header-controls");
    const fontSelect = bodyControls.createEl("select", { cls: "dropdown" });
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

    const sizeInput = bodyControls.createEl("input", { cls: "nr-size-input", type: "text" });
    sizeInput.value = String(this.plugin.settings.fontSize);
    this.uiSizeInput = sizeInput;
    const applySize = async () => {
      if (this.syncing) return;
      const val = Math.max(24, Math.min(72, parseInt(sizeInput.value) || 36));
      sizeInput.value = String(val);
      await this.updateSetting("fontSize", val);
    };
    sizeInput.addEventListener("blur", applySize);
    sizeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applySize(); } });
    sizeInput.addEventListener("wheel", (e) => {
      if (document.activeElement !== sizeInput) return;
      e.preventDefault();
      const cur = parseInt(sizeInput.value) || 36;
      const val = Math.max(24, Math.min(72, cur + (e.deltaY < 0 ? 2 : -2)));
      sizeInput.value = String(val);
      this.updateSetting("fontSize", val);
    }, { passive: false });
    bodyControls.createEl("span", { cls: "nr-size-unit", text: "px" });

    // Preview area
    this.previewContainer = contentEl.createDiv("nr-preview-area");
    this.pageDisplay = this.previewContainer.createDiv("nr-page-display");

    // Right-click context menu on preview
    this.previewContainer.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const menu = new Menu();
      menu.addItem((item) => {
        item.setTitle("导出当前页")
          .setIcon("download")
          .onClick(() => this.handleExportCurrentPage());
      });
      menu.addItem((item) => {
        item.setTitle("导出全部 (ZIP)")
          .setIcon("archive")
          .onClick(() => this.handleExport());
      });
      menu.showAtMouseEvent(e);
    });

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

    // Center: pagination with single-page export
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
    exportBtn.title = "导出全部 ZIP";
    setIcon(exportBtn, "archive");
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
      extractRenderOptions(merged as unknown as Record<string, unknown>),
    );

    this.pages = this.rendered.pages;
    // Hide overlay chip + params when no cover image
    if (this.uiOverlayToggle) {
      const show = this.rendered.hasCoverImage;
      this.uiOverlayToggle.style.display = show ? "" : "none";
      if (this._effectParamRows["coverOverlay"]) {
        this._effectParamRows["coverOverlay"].style.display = show && this.effective.coverOverlay ? "" : "none";
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

    // Map internal key names to user-facing names for renderer_config
    const noteKey = (INTERNAL_TO_NOTE_KEY as Record<string, string>)[key] || key;

    // Update the key in the parsed config
    noteConfig[noteKey] = value;

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
      // JSON stringify for deep equality (handles objects/arrays, primitives)
      if (JSON.stringify(presetVal) !== JSON.stringify(currentVal)) {
        return true;
      }
    }
    return false;
  }

  /** Sync UI control display values to reflect effective settings (e.g. after renderer_config override). */
  private syncUiToSettings(s: NoteRendererSettings): void {
    this.syncing = true;

    // Preset selector: show "(modified)" if current settings differ from saved preset
    if (this.uiPresetSelect) {
      const presetName = this.plugin.settings.activePreset;
      this.uiPresetSelect.value = presetName;
      if (presetName && this.isPresetModified(s)) {
        // Find and update the selected option's display text
        const selectedOpt = this.uiPresetSelect.querySelector<HTMLOptionElement>(`option[value="${CSS.escape(presetName)}"]`);
        if (selectedOpt && !selectedOpt.text.endsWith(" (modified)")) {
          selectedOpt.text = `${presetName} (modified)`;
        }
      } else if (presetName) {
        // Restore original text (in case it was previously marked modified)
        const selectedOpt = this.uiPresetSelect.querySelector<HTMLOptionElement>(`option[value="${CSS.escape(presetName)}"]`);
        if (selectedOpt && selectedOpt.text.endsWith(" (modified)")) {
          selectedOpt.text = presetName;
        }
      }
    }
    if (this.uiThemeSelect) this.uiThemeSelect.value = s.activeTheme;
    if (this.uiModeSelect) this.uiModeSelect.value = s.pageMode;
    if (this.uiModeBtns) {
      this.uiModeBtns.long.classList.toggle("nr-btn-active", s.pageMode === "long");
      this.uiModeBtns.card.classList.toggle("nr-btn-active", s.pageMode === "card");
    }
    if (this.uiSizeInput) this.uiSizeInput.value = String(s.fontSize);
    if (this.uiFontSelect) this.uiFontSelect.value = s.fontFamily;
    if (this.uiCoverFontSelect) this.uiCoverFontSelect.value = s.coverFontFamily;
    if (this.uiScaleInput) this.uiScaleInput.value = String(s.coverFontScale);
    if (this.uiLsLabel) (this.uiLsLabel as any).value = String(s.coverLetterSpacing);
    if (this.uiLhLabel) (this.uiLhLabel as any).value = (s.coverLineHeight / 10).toFixed(1);  // internal 13 → display "1.3"
    if (this.uiStrokeStyleSelect) this.uiStrokeStyleSelect.value = s.coverStrokeStyle;
    if (this.uiStrokeLabel) (this.uiStrokeLabel as any).value = String(s.coverStrokePercent);
    if (this.uiOpLabel) (this.uiOpLabel as any).value = String(s.coverStrokeOpacity);
    if (this.uiGlowLabel) (this.uiGlowLabel as any).value = String(s.coverGlowSize);
    if (this.uiOverlayToggle) this.uiOverlayToggle.classList.toggle("active", s.coverOverlay);
    if (this.uiOxLabel) (this.uiOxLabel as any).value = String(s.coverOffsetX);
    if (this.uiOyLabel) (this.uiOyLabel as any).value = String(s.coverOffsetY);
    if (this.uiShadowToggle) this.uiShadowToggle.classList.toggle("active", s.coverShadow);
    if (this.uiBlurLabel) (this.uiBlurLabel as any).value = String(s.coverShadowBlur);
    if (this.uiBannerToggle) this.uiBannerToggle.classList.toggle("active", s.coverBanner);
    if (this.uiStrokeToggle) {
      const on = s.coverStrokeStyle !== "none";
      this.uiStrokeToggle.classList.toggle("active", on);
    }
    if (this.strokeParamsRow) this.strokeParamsRow.style.display = s.coverStrokeStyle !== "none" ? "" : "none";
    if (this.bannerParamsRow) this.bannerParamsRow.style.display = s.coverBanner ? "" : "none";
    if (this.shadowParamsRow) this.shadowParamsRow.style.display = s.coverShadow ? "" : "none";
    if (this.uiAlignBtns) {
      const align = s.coverTextAlign ?? "left";
      this.uiAlignBtns.left.classList.toggle("nr-btn-active", align === "left");
      this.uiAlignBtns.center.classList.toggle("nr-btn-active", align === "center");
      this.uiAlignBtns.right.classList.toggle("nr-btn-active", align === "right");
    }
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
    const options = extractRenderOptions(this.plugin.settings as unknown as Record<string, unknown>);
    const noteConfig = toNoteConfigKeys(options as unknown as Record<string, unknown>);
    const configJson = JSON.stringify(noteConfig, null, 2);
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

      // Use a dummy container to hold refs
      const ref = document.createElement("div");
      (ref as any)._topStrip = topStrip;
      (ref as any)._bottomStrip = bottomStrip;
      this.coverCropOverlay = ref;
    }

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
    const areaWidth = Math.min(this.previewContainer.clientWidth, 460);
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
    if (!this.pageDisplay) return;
    this.pageDisplay.empty();
    this.currentClone = null;
    this.currentWrapper = null;
    this.pageDisplay.createDiv({ cls: "nr-empty", text: msg });
    if (this.pageIndicator) this.pageIndicator.textContent = "";
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

/** Modal for text input (replaces window.prompt) */
class InputModal extends Modal {
  private result: string;
  private onSubmit: (result: string | null) => void;
  private placeholder: string;
  private title: string;

  constructor(app: import("obsidian").App, title: string, placeholder: string, onSubmit: (result: string | null) => void) {
    super(app);
    this.title = title;
    this.placeholder = placeholder;
    this.result = placeholder;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h4", { text: this.title });

    new Setting(contentEl)
      .addText((text) =>
        text.setValue(this.placeholder).onChange((value) => {
          this.result = value;
        })
      );

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("确定").setCta().onClick(() => {
          this.close();
          this.onSubmit(this.result);
        })
      )
      .addButton((btn) =>
        btn.setButtonText("取消").onClick(() => {
          this.close();
          this.onSubmit(null);
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** Modal for confirmation (replaces window.confirm) */
class ConfirmModal extends Modal {
  private message: string;
  private onConfirm: (confirmed: boolean) => void;

  constructor(app: import("obsidian").App, message: string, onConfirm: (confirmed: boolean) => void) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("确定").setCta().onClick(() => {
          this.close();
          this.onConfirm(true);
        })
      )
      .addButton((btn) =>
        btn.setButtonText("取消").onClick(() => {
          this.close();
          this.onConfirm(false);
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}
