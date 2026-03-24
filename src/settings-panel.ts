import { Notice, Menu, setIcon } from "obsidian";
import type { App } from "obsidian";
import { EFFECT_META, RENDER_DEFAULTS } from "./schema";
import { InputModal, ConfirmModal } from "./modals";
import { PRESET_KEYS } from "./main";
import type NoteRendererPlugin from "./main";
import type { NoteRendererSettings } from "./main";

// ── Interfaces ──────────────────────────────────────────────────────────────

/** What the panel builder needs from the host view. */
export interface PanelHost {
  plugin: NoteRendererPlugin;
  app: App;
  effective: NoteRendererSettings;
  syncing: boolean;
  editingNoteConfig: boolean;
  lastStrokeStyle: string;

  updateSetting<K extends keyof NoteRendererSettings>(key: K, value: NoteRendererSettings[K]): Promise<void>;
  updateNoteConfig(key: string, value: unknown): Promise<void>;
  refresh(): Promise<void>;
  goPage(delta: number): void;
  handleExportCurrentPage(): Promise<void>;
  handleExport(): Promise<void>;
  handleSaveToNote(): Promise<void>;
  handleRemoveFromNote(): Promise<void>;
  rebuildPresetOptions(): void;
}

/** DOM element references returned by the panel builder. */
export interface PanelRefs {
  presetSelect: HTMLSelectElement;
  themeSelect: HTMLSelectElement;
  modeSelect: HTMLSelectElement;
  modeBtns: { long: HTMLElement; card: HTMLElement };
  sizeInput: HTMLInputElement;
  fontSelect: HTMLSelectElement;
  coverFontSelect: HTMLSelectElement;
  scaleInput: HTMLInputElement;
  lsInput: HTMLInputElement;
  lhInput: HTMLInputElement;
  strokeStyleSelect: HTMLSelectElement;
  strokeInput: HTMLInputElement;
  opInput: HTMLInputElement;
  glowInput: HTMLInputElement;
  overlayToggle: HTMLElement;
  oxInput: HTMLInputElement;
  oyInput: HTMLInputElement;
  shadowToggle: HTMLElement;
  blurInput: HTMLInputElement;
  bannerToggle: HTMLElement;
  strokeToggle: HTMLElement;
  strokeParamsRow: HTMLElement;
  bannerParamsRow: HTMLElement;
  shadowParamsRow: HTMLElement;
  alignBtns: { left: HTMLElement; center: HTMLElement; right: HTMLElement };
  effectParamRows: Record<string, HTMLElement>;
  saveToNoteBtn: HTMLElement;
  removeFromNoteBtn: HTMLElement;
  coverSection: HTMLElement;
  bodySection: HTMLElement;
  previewContainer: HTMLElement;
  pageDisplay: HTMLElement;
  pageIndicator: HTMLElement;
  modeIndicator: HTMLElement;
}

// ── Font lists ──────────────────────────────────────────────────────────────

const COVER_FONTS = [
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
];

const BODY_FONTS = [
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

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Toggle an accordion section, closing siblings. */
function toggleSection(target: HTMLElement): void {
  const opening = !target.classList.contains("open");
  if (opening) {
    target.parentElement?.querySelectorAll(".nr-section.open").forEach((s) => {
      if (s !== target) s.classList.remove("open");
    });
  }
  target.classList.toggle("open");
}

/** Create a labeled input field with scroll-wheel support. Returns the input element. */
function makeField(
  host: PanelHost,
  parent: HTMLElement,
  label: string,
  value: string,
  opts: { min: number; max: number; step?: number; unit?: string; transform?: (v: number) => string; parse?: (v: string) => number },
  onUpdate: (val: number) => Promise<void>,
): HTMLInputElement {
  const group = parent.createDiv("nr-field");
  if (label) group.createEl("span", { cls: "nr-field-label", text: label });
  const input = group.createEl("input", { cls: "nr-field-input", type: "text" });
  input.value = value;
  if (opts.unit) group.createEl("span", { cls: "nr-field-unit", text: opts.unit });
  const step = opts.step ?? 1;
  const parse = opts.parse ?? ((v: string) => parseFloat(v) || 0);
  const transform = opts.transform ?? String;
  const applyVal = async (raw: number) => {
    if (host.syncing) return;
    const val = Math.max(opts.min, Math.min(opts.max, raw));
    input.value = transform(val);
    await onUpdate(val);
  };
  const apply = () => applyVal(parse(input.value));
  input.addEventListener("blur", apply);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } });
  input.addEventListener("wheel", (e) => {
    if (document.activeElement !== input) return;
    e.preventDefault();
    const current = parse(input.value);
    const delta = e.deltaY < 0 ? step : -step;
    applyVal(current + delta);
  }, { passive: false });
  return input;
}

// ── Panel builder ───────────────────────────────────────────────────────────

export function buildSettingsPanel(host: PanelHost, contentEl: HTMLElement): PanelRefs {
  contentEl.empty();
  contentEl.classList.add("nr-view");

  // ── Top bar: 预设 (compact) ──
  const presetBar = contentEl.createDiv("nr-top-bar");
  presetBar.createEl("span", { cls: "nr-row-label", text: "预设" });
  const presetSelect = presetBar.createEl("select", { cls: "dropdown" });
  host.rebuildPresetOptions();
  presetSelect.addEventListener("change", async () => {
    if (host.syncing) return;
    const name = presetSelect.value;
    if (name) {
      host.plugin.loadPreset(name);
    } else {
      host.plugin.settings.activePreset = "";
    }
    await host.plugin.saveSettings();
    await host.refresh();
  });

  const presetSaveBtn = presetBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "保存" });
  presetSaveBtn.style.width = "auto";
  presetSaveBtn.style.padding = "0 8px";
  presetSaveBtn.title = "保存当前配置为预设";
  presetSaveBtn.addEventListener("click", () => {
    new InputModal(host.app, "保存预设", host.plugin.settings.activePreset || "", async (name) => {
      if (!name) return;
      const preset: Record<string, unknown> = {};
      for (const key of PRESET_KEYS) {
        preset[key] = (host.effective as Record<string, unknown>)[key];
      }
      host.plugin.settings.presets[name] = preset as Partial<import("./main").RendererPreset>;
      host.plugin.settings.activePreset = name;
      await host.plugin.saveSettings();
      host.rebuildPresetOptions();
      new Notice(`预设「${name}」已保存`);
    }).open();
  });

  const presetDelBtn = presetBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "删除" });
  presetDelBtn.style.width = "auto";
  presetDelBtn.style.padding = "0 8px";
  presetDelBtn.title = "删除当前预设";
  presetDelBtn.addEventListener("click", () => {
    const name = host.plugin.settings.activePreset;
    if (!name) { new Notice("没有选中预设"); return; }
    new ConfirmModal(host.app, `删除预设「${name}」？`, async (confirmed) => {
      if (!confirmed) return;
      host.plugin.deletePreset(name);
      await host.plugin.saveSettings();
      host.rebuildPresetOptions();
      new Notice(`预设「${name}」已删除`);
      await host.refresh();
    }).open();
  });

  // ── Quick bar: 主题 + 模式 ──
  const quickBar = contentEl.createDiv("nr-quick-bar");
  quickBar.createEl("span", { cls: "nr-row-label", text: "主题" });
  const themeSelect = quickBar.createEl("select", { cls: "dropdown" });
  host.plugin.getThemeNames().forEach((name) => {
    themeSelect.createEl("option", { text: name, value: name });
  });
  themeSelect.value = host.plugin.settings.activeTheme;
  themeSelect.addEventListener("change", async () => {
    if (host.syncing) return;
    await host.updateSetting("activeTheme", themeSelect.value);
  });

  // Mode toggle buttons (mutually exclusive, pushed right)
  quickBar.createDiv().style.flex = "1";
  const modeBtn35 = quickBar.createEl("button", {
    cls: `nr-btn nr-btn-sm${host.plugin.settings.pageMode === "long" ? " nr-btn-active" : ""}`,
    text: "3:5",
  });
  modeBtn35.style.width = "auto";
  modeBtn35.style.padding = "0 8px";
  const modeBtn34 = quickBar.createEl("button", {
    cls: `nr-btn nr-btn-sm${host.plugin.settings.pageMode === "card" ? " nr-btn-active" : ""}`,
    text: "3:4",
  });
  modeBtn34.style.width = "auto";
  modeBtn34.style.padding = "0 8px";

  const setMode = async (mode: "long" | "card") => {
    if (host.syncing) return;
    modeBtn35.classList.toggle("nr-btn-active", mode === "long");
    modeBtn34.classList.toggle("nr-btn-active", mode === "card");
    await host.updateSetting("pageMode", mode);
  };
  modeBtn35.addEventListener("click", () => setMode("long"));
  modeBtn34.addEventListener("click", () => setMode("card"));

  // Keep a hidden select for syncUI compatibility
  const modeSelect = document.createElement("select");
  modeSelect.style.display = "none";
  modeSelect.createEl("option", { text: "长文 3:5", value: "long" });
  modeSelect.createEl("option", { text: "图文 3:4", value: "card" });
  modeSelect.value = host.plugin.settings.pageMode;

  // ── Cover section (wraps two accordion sections) ──
  const coverSection = contentEl.createDiv("nr-cover-section");

  // ── Section: 封面文字 (collapsible) ──
  const coverTextSection = coverSection.createDiv("nr-section open");
  const coverTextHead = coverTextSection.createDiv("nr-section-head");
  coverTextHead.createEl("span", { cls: "nr-section-chevron", text: "▶" });
  coverTextHead.createEl("span", { cls: "nr-section-title", text: "封面文字" });

  // Header inline controls: font select + scale input + align icons
  const coverHeadControls = coverTextHead.createDiv("nr-header-controls");

  const coverFontSelect = coverHeadControls.createEl("select", { cls: "dropdown" });
  COVER_FONTS.forEach((f) => coverFontSelect.createEl("option", { text: f.label, value: f.value }));
  coverFontSelect.value = host.plugin.settings.coverFontFamily;
  coverFontSelect.addEventListener("click", (e) => e.stopPropagation());
  coverFontSelect.addEventListener("change", async () => {
    if (host.syncing) return;
    await host.updateSetting("coverFontFamily", coverFontSelect.value);
  });

  const scaleInput = coverHeadControls.createEl("input", { cls: "nr-size-input", type: "text" }) as HTMLInputElement;
  scaleInput.value = String(host.plugin.settings.coverFontScale);
  scaleInput.addEventListener("click", (e) => e.stopPropagation());
  const applyScale = async () => {
    if (host.syncing) return;
    const val = Math.max(50, Math.min(300, parseInt(scaleInput.value) || 90));
    scaleInput.value = String(val);
    await host.updateSetting("coverFontScale", val);
  };
  scaleInput.addEventListener("blur", applyScale);
  scaleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyScale(); } });
  scaleInput.addEventListener("wheel", (e) => {
    if (document.activeElement !== scaleInput) return;
    e.preventDefault();
    const cur = parseInt(scaleInput.value) || 90;
    const val = Math.max(50, Math.min(300, cur + (e.deltaY < 0 ? 10 : -10)));
    scaleInput.value = String(val);
    host.updateSetting("coverFontScale", val);
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
      cls: `nr-btn nr-btn-sm${(host.plugin.settings.coverTextAlign ?? "left") === def.key ? " nr-btn-active" : ""}`,
    });
    btn.title = def.title;
    setIcon(btn, def.icon);
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (host.syncing) return;
      Object.values(alignBtns).forEach((b) => b.classList.remove("nr-btn-active"));
      btn.classList.add("nr-btn-active");
      await host.updateSetting("coverTextAlign", def.key);
    });
    alignBtns[def.key] = btn;
  });

  coverTextHead.addEventListener("click", () => toggleSection(coverTextSection));

  // ── Section body ──
  const coverTextBody = coverTextSection.createDiv("nr-section-body");

  // Text effect chips: 描边 / 色带 / 投影
  host.lastStrokeStyle = host.plugin.settings.coverStrokeStyle !== "none" ? host.plugin.settings.coverStrokeStyle : "stroke";
  const strokeEnabled = host.plugin.settings.coverStrokeStyle !== "none";

  const textEffectRow = coverTextBody.createDiv("nr-row");
  textEffectRow.createEl("span", { cls: "nr-row-label", text: "效果" });
  const strokeToggle = textEffectRow.createEl("span", { cls: `nr-chip${strokeEnabled ? " active" : ""}`, text: "描边" });
  const bannerToggle = textEffectRow.createEl("span", { cls: `nr-chip${host.plugin.settings.coverBanner ? " active" : ""}`, text: "色带" });
  const shadowToggle = textEffectRow.createEl("span", { cls: `nr-chip${host.plugin.settings.coverShadow ? " active" : ""}`, text: "投影" });

  // Combined row: color + weight + spacing + line height
  const styleRow = coverTextBody.createDiv("nr-row");
  styleRow.createEl("span", { cls: "nr-row-label", text: "样式" });

  const colorInput = styleRow.createEl("input", { cls: "nr-color-dot", type: "color" });
  colorInput.value = host.plugin.settings.coverFontColor || "#e07c5a";
  colorInput.title = "封面文字颜色（双击重置为主题默认）";
  colorInput.addEventListener("input", async () => {
    await host.updateSetting("coverFontColor", colorInput.value);
  });
  colorInput.addEventListener("dblclick", async (e) => {
    e.preventDefault();
    if (host.syncing) return;
    colorInput.value = "#e07c5a";
    await host.updateSetting("coverFontColor", "");
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
  weightSelect.value = String(host.plugin.settings.coverFontWeight ?? 800);
  weightSelect.addEventListener("change", async () => {
    if (host.syncing) return;
    await host.updateSetting("coverFontWeight", parseInt(weightSelect.value));
  });

  const lsInput = makeField(host, styleRow, "间距", String(host.plugin.settings.coverLetterSpacing),
    { min: -5, max: 30 },
    (val) => host.updateSetting("coverLetterSpacing", val));

  const lhInput = makeField(host, styleRow, "行高", (host.plugin.settings.coverLineHeight / 10).toFixed(1),
    { min: 0.8, max: 2.5, step: 0.1, transform: (v) => v.toFixed(1) },
    (val) => host.updateSetting("coverLineHeight", Math.round(val * 10)));

  // Position row
  const posRow = coverTextBody.createDiv("nr-row");
  posRow.createEl("span", { cls: "nr-row-label", text: "位置" });

  const oxInput = makeField(host, posRow, "X", String(host.plugin.settings.coverOffsetX),
    { min: -50, max: 50, unit: "%" },
    (val) => host.updateSetting("coverOffsetX", val));

  const oyInput = makeField(host, posRow, "Y", String(host.plugin.settings.coverOffsetY),
    { min: -50, max: 50, unit: "%" },
    (val) => host.updateSetting("coverOffsetY", val));

  // ── Stroke sub-params (in coverTextBody) ──
  const strokeParamsRow = coverTextBody.createDiv("nr-row");
  strokeParamsRow.createEl("span", { cls: "nr-row-label", text: "描边" });
  strokeParamsRow.style.display = strokeEnabled ? "" : "none";

  const strokeStyleSelect = strokeParamsRow.createEl("select", { cls: "dropdown" });
  strokeStyleSelect.style.width = "72px";
  strokeStyleSelect.style.flex = "none";
  [
    { label: "描边", value: "stroke" },
    { label: "双层", value: "double" },
    { label: "发光", value: "glow" },
  ].forEach((s) => strokeStyleSelect.createEl("option", { text: s.label, value: s.value }));
  strokeStyleSelect.value = strokeEnabled ? host.plugin.settings.coverStrokeStyle : host.lastStrokeStyle;

  const strokeInput = makeField(host, strokeParamsRow, "粗", String(host.plugin.settings.coverStrokePercent),
    { min: 0, max: 100 },
    (val) => host.updateSetting("coverStrokePercent", val));

  const opInput = makeField(host, strokeParamsRow, "透", String(host.plugin.settings.coverStrokeOpacity),
    { min: 0, max: 100 },
    (val) => host.updateSetting("coverStrokeOpacity", val));

  const glowField = strokeParamsRow.createDiv("nr-field");
  glowField.createEl("span", { cls: "nr-field-label", text: "光" });
  const glowInput = glowField.createEl("input", { cls: "nr-field-input", type: "text" }) as HTMLInputElement;
  glowInput.value = String(host.plugin.settings.coverGlowSize);
  const applyGlow = async () => {
    if (host.syncing) return;
    const val = Math.max(0, Math.min(200, parseInt(glowInput.value) || 0));
    glowInput.value = String(val);
    await host.updateSetting("coverGlowSize", val);
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
    if (host.syncing) return;
    const style = strokeStyleSelect.value as import("./constants").CoverStrokeStyle;
    host.lastStrokeStyle = style;
    const defaults: Record<string, number> = { stroke: 20, double: 5, glow: 6 };
    const newPercent = defaults[style] ?? 8;
    strokeInput.value = String(newPercent);
    updateGlowVisibility();
    if (host.editingNoteConfig) {
      await host.updateNoteConfig("coverStrokeStyle", style);
      await host.updateNoteConfig("coverStrokePercent", newPercent);
      await host.refresh();
    } else {
      host.plugin.settings.coverStrokeStyle = style;
      host.plugin.settings.coverStrokePercent = newPercent;
      host.plugin.settings.activePreset = "";
      if (presetSelect) presetSelect.value = "";
      await host.plugin.saveSettings();
      await host.refresh();
    }
  });

  strokeToggle.addEventListener("click", async () => {
    if (host.syncing) return;
    const currentStyle = host.effective.coverStrokeStyle;
    if (currentStyle !== "none") {
      host.lastStrokeStyle = currentStyle;
      strokeToggle.classList.remove("active");
      strokeParamsRow.style.display = "none";
      await host.updateSetting("coverStrokeStyle", "none");
    } else {
      strokeToggle.classList.add("active");
      strokeParamsRow.style.display = "";
      strokeStyleSelect.value = host.lastStrokeStyle;
      updateGlowVisibility();
      await host.updateSetting("coverStrokeStyle", host.lastStrokeStyle as import("./constants").CoverStrokeStyle);
    }
  });

  // ── Banner sub-params (in coverTextBody) ──
  const bannerParamsRow = coverTextBody.createDiv("nr-row");
  bannerParamsRow.createEl("span", { cls: "nr-row-label", text: "色带" });
  bannerParamsRow.style.display = host.plugin.settings.coverBanner ? "" : "none";

  const parseColor = (c: string) => {
    if (c.startsWith("#")) return c;
    const m = c.match(/[\d.]+/g);
    if (!m) return "#000000";
    return "#" + [0,1,2].map(i => Math.round(Number(m[i])).toString(16).padStart(2, "0")).join("");
  };
  const bannerColorInput = bannerParamsRow.createEl("input", { cls: "nr-color-dot", type: "color" });
  bannerColorInput.value = parseColor(host.plugin.settings.coverBannerColor);

  const bannerAlpha = Math.round((parseFloat((host.plugin.settings.coverBannerColor.match(/[\d.]+/g) || [])[3] ?? "0.5") * 100));
  let currentAlpha = bannerAlpha / 100;

  makeField(host, bannerParamsRow, "", String(bannerAlpha),
    { min: 0, max: 100, unit: "%" },
    async (val) => { currentAlpha = val / 100; await updateBannerColor(); });

  makeField(host, bannerParamsRow, "斜", String(host.plugin.settings.coverBannerSkew),
    { min: 0, max: 20 },
    (val) => host.updateSetting("coverBannerSkew", val));

  bannerToggle.addEventListener("click", async () => {
    if (host.syncing) return;
    const val = !host.effective.coverBanner;
    bannerToggle.classList.toggle("active", val);
    bannerParamsRow.style.display = val ? "" : "none";
    await host.updateSetting("coverBanner", val);
  });

  const updateBannerColor = async () => {
    const hex = bannerColorInput.value;
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const rgba = `rgba(${r},${g},${b},${currentAlpha})`;
    await host.updateSetting("coverBannerColor", rgba);
  };
  bannerColorInput.addEventListener("input", updateBannerColor);

  // ── Shadow sub-params (in coverTextBody) ──
  const shadowParamsRow = coverTextBody.createDiv("nr-row");
  shadowParamsRow.createEl("span", { cls: "nr-row-label", text: "投影" });
  shadowParamsRow.style.display = host.plugin.settings.coverShadow ? "" : "none";

  shadowToggle.addEventListener("click", async () => {
    if (host.syncing) return;
    const val = !host.effective.coverShadow;
    shadowToggle.classList.toggle("active", val);
    shadowParamsRow.style.display = val ? "" : "none";
    await host.updateSetting("coverShadow", val);
  });

  const blurInput = makeField(host, shadowParamsRow, "模糊", String(host.plugin.settings.coverShadowBlur),
    { min: 0, max: 200 },
    (val) => host.updateSetting("coverShadowBlur", val));

  makeField(host, shadowParamsRow, "X", String(host.plugin.settings.coverShadowOffsetX),
    { min: -100, max: 100 },
    (val) => host.updateSetting("coverShadowOffsetX", val));

  makeField(host, shadowParamsRow, "Y", String(host.plugin.settings.coverShadowOffsetY),
    { min: -100, max: 100 },
    (val) => host.updateSetting("coverShadowOffsetY", val));

  // ── Section: 效果 (decorative overlays only) ──
  const effectSection = coverSection.createDiv("nr-section");
  const effectHead = effectSection.createDiv("nr-section-head");
  effectHead.createEl("span", { cls: "nr-section-chevron", text: "▶" });
  effectHead.createEl("span", { cls: "nr-section-title", text: "效果" });

  const effectChips = effectHead.createDiv("nr-header-chips");

  const effects = host.plugin.settings.coverEffects ?? RENDER_DEFAULTS.coverEffects;
  const chipToggle = (parent: HTMLElement, label: string, effectName: string, active: boolean) => {
    const chip = parent.createEl("span", { cls: `nr-chip${active ? " active" : ""}`, text: label });
    chip.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (host.syncing) return;
      const current = host.effective.coverEffects[effectName];
      const newEnabled = !current?.enabled;
      chip.classList.toggle("active", newEnabled);
      const updated = { ...host.effective.coverEffects, [effectName]: { ...current, enabled: newEnabled } };
      await host.updateSetting("coverEffects", updated);
    });
    return chip;
  };

  // Build effect chips from registry
  let overlayToggle: HTMLElement = null!;
  for (const [name, meta] of Object.entries(EFFECT_META)) {
    const chip = chipToggle(effectChips, meta.label, name, effects[name]?.enabled ?? false);
    if (name === "overlay") overlayToggle = chip;
  }

  effectHead.addEventListener("click", () => toggleSection(effectSection));

  // ── Effect section body: opacity sub-params ──
  const effectBody = effectSection.createDiv("nr-section-body");

  // Build effect opacity rows from registry
  const effectParamRows: Record<string, HTMLElement> = {};
  for (const [name, meta] of Object.entries(EFFECT_META)) {
    const params = effects[name];
    const row = effectBody.createDiv("nr-row");
    row.createEl("span", { cls: "nr-row-label", text: meta.label });
    row.style.display = params?.enabled ? "" : "none";
    effectParamRows[name] = row;
    makeField(host, row, "强度", String(params?.opacity ?? 50),
      { min: meta.min, max: meta.max, unit: "%" },
      (val) => {
        const eff = host.effective.coverEffects ?? effects;
        const updated = { ...eff, [name]: { ...eff[name], opacity: val } };
        return host.updateSetting("coverEffects", updated);
      });
    // Wire chip toggle to show/hide this row
    const chips = effectChips.querySelectorAll(".nr-chip");
    for (const chip of chips) {
      if (chip.textContent === meta.label) {
        chip.addEventListener("click", () => {
          row.style.display = chip.classList.contains("active") ? "" : "none";
        });
      }
    }
  }

  // ── Body section: flat row (no accordion) ──
  const bodySection = contentEl.createDiv("nr-flat-row");
  bodySection.createEl("span", { cls: "nr-section-title", text: "正文" });

  const bodyControls = bodySection.createDiv("nr-header-controls");
  const fontSelect = bodyControls.createEl("select", { cls: "dropdown" });
  BODY_FONTS.forEach((f) => {
    fontSelect.createEl("option", { text: f.label, value: f.value });
  });
  fontSelect.value = host.plugin.settings.fontFamily;
  fontSelect.addEventListener("change", async () => {
    if (host.syncing) return;
    await host.updateSetting("fontFamily", fontSelect.value);
  });

  const sizeInput = bodyControls.createEl("input", { cls: "nr-size-input", type: "text" }) as HTMLInputElement;
  sizeInput.value = String(host.plugin.settings.fontSize);
  const applySize = async () => {
    if (host.syncing) return;
    const val = Math.max(24, Math.min(72, parseInt(sizeInput.value) || 36));
    sizeInput.value = String(val);
    await host.updateSetting("fontSize", val);
  };
  sizeInput.addEventListener("blur", applySize);
  sizeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applySize(); } });
  sizeInput.addEventListener("wheel", (e) => {
    if (document.activeElement !== sizeInput) return;
    e.preventDefault();
    const cur = parseInt(sizeInput.value) || 36;
    const val = Math.max(24, Math.min(72, cur + (e.deltaY < 0 ? 2 : -2)));
    sizeInput.value = String(val);
    host.updateSetting("fontSize", val);
  }, { passive: false });
  bodyControls.createEl("span", { cls: "nr-size-unit", text: "px" });

  // Preview area
  const previewContainer = contentEl.createDiv("nr-preview-area");
  const pageDisplay = previewContainer.createDiv("nr-page-display");

  // Right-click context menu on preview
  previewContainer.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle("导出当前页")
        .setIcon("download")
        .onClick(() => host.handleExportCurrentPage());
    });
    menu.addItem((item) => {
      item.setTitle("导出全部 (ZIP)")
        .setIcon("archive")
        .onClick(() => host.handleExport());
    });
    menu.showAtMouseEvent(e);
  });

  // Navigation — 3-column layout
  const nav = contentEl.createDiv("nr-nav");

  // Left: mode indicator only
  const navLeft = nav.createDiv("nr-nav-left");
  const modeIndicator = navLeft.createEl("span", { cls: "nr-mode-indicator nr-clickable" });

  // Center: pagination with single-page export
  const navCenter = nav.createDiv("nr-nav-center");
  const prevBtn = navCenter.createEl("button", { cls: "nr-nav-btn" });
  setIcon(prevBtn, "chevron-left");
  prevBtn.addEventListener("click", () => host.goPage(-1));

  const pageIndicator = navCenter.createDiv("nr-page-indicator");
  const nextBtn = navCenter.createEl("button", { cls: "nr-nav-btn" });
  setIcon(nextBtn, "chevron-right");
  nextBtn.addEventListener("click", () => host.goPage(1));

  // Right: actions + export
  const navRight = nav.createDiv("nr-nav-right");

  const saveToNoteBtn = navRight.createEl("button", { cls: "nr-btn nr-btn-sm", text: "存入笔记" });
  saveToNoteBtn.title = "保存当前配置到笔记";
  saveToNoteBtn.style.minWidth = "72px";
  saveToNoteBtn.addEventListener("click", () => host.handleSaveToNote());

  const removeFromNoteBtn = navRight.createEl("button", { cls: "nr-btn nr-btn-sm", text: "移除" });
  removeFromNoteBtn.title = "移除笔记中的渲染配置";
  removeFromNoteBtn.style.minWidth = "48px";
  removeFromNoteBtn.addEventListener("click", () => host.handleRemoveFromNote());

  navRight.createDiv({ cls: "nr-nav-separator" });

  const exportBtn = navRight.createEl("button", { cls: "nr-nav-btn" });
  exportBtn.title = "导出全部 ZIP";
  setIcon(exportBtn, "archive");
  exportBtn.addEventListener("click", () => host.handleExport());

  return {
    presetSelect,
    themeSelect,
    modeSelect,
    modeBtns: { long: modeBtn35, card: modeBtn34 },
    sizeInput,
    fontSelect,
    coverFontSelect,
    scaleInput,
    lsInput,
    lhInput,
    strokeStyleSelect,
    strokeInput,
    opInput,
    glowInput,
    overlayToggle,
    oxInput,
    oyInput,
    shadowToggle,
    blurInput,
    bannerToggle,
    strokeToggle,
    strokeParamsRow,
    bannerParamsRow,
    shadowParamsRow,
    alignBtns: alignBtns as { left: HTMLElement; center: HTMLElement; right: HTMLElement },
    effectParamRows,
    saveToNoteBtn,
    removeFromNoteBtn,
    coverSection,
    bodySection,
    previewContainer,
    pageDisplay,
    pageIndicator,
    modeIndicator,
  };
}
