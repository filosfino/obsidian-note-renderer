import { Notice, Menu, setIcon } from "obsidian";
import type { App } from "obsidian";
import { FIELD_SCHEMAS, EFFECT_SCHEMAS, BODY_EFFECT_NAMES, RENDER_DEFAULTS, COVER_STROKE_STYLE_UI, COVER_SEMANTIC_SCHEMA, getDefaultCoverPaddingX, isCoverSemanticFieldActive, getFieldSchema } from "./schema";
import { InputModal, ConfirmModal, FontManagerModal } from "./modals";
import { getCoverFontList, getBodyFontList, type FontEntry } from "./fonts";
import { deriveCoverStrokePalette, extractThemeColorChoices, extractCoverTitleColor, detectThemeBrightness, type ThemeColorChoice } from "./effects";
import type NoteRendererPlugin from "./main";
import type { RendererConfig } from "./plugin-types";

// ── Interfaces ──────────────────────────────────────────────────────────────

/** What the panel builder needs from the host view. */
export interface PanelHost {
  plugin: NoteRendererPlugin;
  app: App;
  effective: RendererConfig;
  syncing: boolean;
  editingNoteConfig: boolean;
  lastStrokeStyle: string;

  updateSetting<K extends keyof RendererConfig>(key: K, value: RendererConfig[K]): Promise<void>;
  updateNoteConfig(key: string, value: unknown): Promise<void>;
  refresh(): Promise<void>;
  goPage(delta: number): void;
  handleExportCurrentPage(): Promise<void>;
  handleExport(): Promise<void>;
  applyPreset(name: string): Promise<void>;
  clearPresetSelection(): Promise<void>;
  handleSaveToNote(): Promise<void>;
  handleRemoveFromNote(): Promise<void>;
  rebuildPresetOptions(): void;
}

/** DOM element references returned by the panel builder. */
export interface PanelRefs {
  presetSelect: HTMLSelectElement;
  presetLockBtn: HTMLButtonElement;
  configSourceBadge: HTMLElement;
  themeSelect: HTMLSelectElement;
  modeSelect: HTMLSelectElement;
  modeBtns: { long: HTMLElement; card: HTMLElement };
  sizeInput: HTMLInputElement;
  fontSelect: HTMLSelectElement;
  coverFontSelect: HTMLSelectElement;
  scaleInput: HTMLInputElement;
  coverOpacityInput: HTMLInputElement;
  coverMarkStyleBtns: { marker: HTMLElement; block: HTMLElement; underline: HTMLElement };
  lsInput: HTMLInputElement;
  lhInput: HTMLInputElement;
  strokeStyleSelect: HTMLSelectElement;
  strokeInput: HTMLInputElement;
  opInput: HTMLInputElement;
  doubleStrokeInput: HTMLInputElement;
  glowToggle: HTMLElement;
  glowInput: HTMLInputElement;
  strokeColorInput: HTMLInputElement;
  doubleStrokeColorInput: HTMLInputElement;
  strokeAlphaInput: HTMLInputElement;
  glowColorInput: HTMLInputElement;
  overlayToggle: HTMLElement;
  oxInput: HTMLInputElement;
  oyInput: HTMLInputElement;
  coverPaddingInput: HTMLInputElement;
  shadowToggle: HTMLElement;
  blurInput: HTMLInputElement;
  shadowColorInput: HTMLInputElement;
  shadowAlphaInput: HTMLInputElement;
  bannerToggle: HTMLElement;
  strokeToggle: HTMLElement;
  strokeParamsRow: HTMLElement;
  doubleStrokeField: HTMLElement;
  doubleStrokeColorField: HTMLElement;
  glowParamsRow: HTMLElement;
  bannerParamsRow: HTMLElement;
  shadowParamsRow: HTMLElement;
  alignBtns: { left: HTMLElement; center: HTMLElement; right: HTMLElement };
  coverEffectChips: Record<string, HTMLElement>;
  coverEffectParamRows: Record<string, HTMLElement>;
  bodyEffectChips: Record<string, HTMLElement>;
  bodyEffectParamRows: Record<string, HTMLElement>;
  coverColorInput: HTMLInputElement;
  saveToNoteBtn: HTMLElement;
  removeFromNoteBtn: HTMLElement;
  coverSection: HTMLElement;
  bodySection: HTMLElement;
  bodyEffectsSection: HTMLElement;
  listStyleBtns: { default: HTMLElement; capsule: HTMLElement };
  previewContainer: HTMLElement;
  pageDisplay: HTMLElement;
  pageIndicator: HTMLElement;
}

// ── Font helpers ────────────────────────────────────────────────────────────

/** Set a select's value, adding a temporary "[未安装]" option if value isn't in the list */
export function setSelectValue(select: HTMLSelectElement, value: string | null | undefined): void {
  const normalized = value ?? "";
  select.value = normalized;
  if (select.value === normalized) return;
  if (!normalized) {
    select.selectedIndex = 0;
    return;
  }
  // Value not in current options — add a temporary placeholder
  const label = normalized.replace(/"/g, "").split(",")[0].trim();
  select.createEl("option", { text: `${label} [未安装]`, value: normalized });
  select.value = normalized;
}

/** Rebuild a font select's options from a font list */
function rebuildFontOptions(select: HTMLSelectElement, fonts: FontEntry[], currentValue: string | null | undefined): void {
  select.empty();
  fonts.forEach(f => select.createEl("option", { text: f.label, value: f.value }));
  setSelectValue(select, currentValue);
}

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

/** Build makeField opts from a FieldSchema. Numeric fields only. */
function schemaOpts(key: string): { min: number; max: number; step?: number; unit?: string; transform?: (v: number) => string; parse?: (v: string) => number } {
  const s = getFieldSchema(key);
  if (!s || s.type !== "number") return { min: 0, max: 100 };
  return {
    min: s.min, max: s.max,
    ...(s.step !== undefined && s.step !== 1 ? { step: s.step } : {}),
    ...(s.unit ? { unit: s.unit } : {}),
    ...(s.toDisplay ? { transform: s.toDisplay } : {}),
    ...(s.fromDisplay ? { parse: s.fromDisplay } : {}),
  };
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
  const apply = () => { void applyVal(parse(input.value)); };
  input.addEventListener("blur", apply);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } });
  input.addEventListener("wheel", (e) => {
    if (document.activeElement !== input) return;
    e.preventDefault();
    const current = parse(input.value);
    const delta = e.deltaY < 0 ? step : -step;
    void applyVal(current + delta);
  }, { passive: false });
  return input;
}

function parseColorValue(color: string | null | undefined, fallback = "#000000"): string {
  if (!color) return fallback;
  if (color.startsWith("#")) return color;
  const parts = color.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return fallback;
  return "#" + [0, 1, 2]
    .map((index) => Math.round(Number(parts[index])).toString(16).padStart(2, "0"))
    .join("");
}

function parseAlphaPercent(color: string | null | undefined, fallback = 100): number {
  if (!color) return fallback;
  const parts = color.match(/[\d.]+/g);
  if (!parts || parts.length < 4) return fallback;
  return Math.round(parseFloat(parts[3]) * 100);
}

function buildRgba(hex: string, alphaPercent: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const alpha = Math.max(0, Math.min(100, alphaPercent)) / 100;
  return `rgba(${r},${g},${b},${alpha})`;
}

async function resolveEffectFallbackColor(host: PanelHost): Promise<string> {
  const themeCss = await host.plugin.loadTheme(host.effective.activeTheme);
  return detectThemeBrightness(themeCss, host.effective.activeTheme) ? "#ffffff" : "#000000";
}

interface DynamicNumberOpts {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

function makeDynamicNumberField(
  host: PanelHost,
  parent: HTMLElement,
  label: string,
  value: string,
  resolveOpts: () => DynamicNumberOpts,
  onUpdate: (value: number) => Promise<void>,
): HTMLInputElement {
  const field = parent.createDiv("nr-field");
  if (label) field.createEl("span", { cls: "nr-field-label", text: label });
  const input = field.createEl("input", { cls: "nr-field-input", type: "text" });
  input.value = value;

  const apply = async () => {
    if (host.syncing) return;
    const opts = resolveOpts();
    const val = Math.max(opts.min, Math.min(opts.max, parseFloat(input.value) || opts.defaultValue));
    input.value = String(val);
    await onUpdate(val);
  };

  input.addEventListener("blur", () => { void apply(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void apply();
    }
  });
  input.addEventListener("wheel", (e) => {
    if (document.activeElement !== input) return;
    e.preventDefault();
    const opts = resolveOpts();
    const current = parseFloat(input.value) || opts.defaultValue;
    input.value = String(current + (e.deltaY < 0 ? opts.step : -opts.step));
    void apply();
  }, { passive: false });

  return input;
}

interface ThemeBoundColorInputOptions {
  host: PanelHost;
  input: HTMLInputElement;
  popoverTitle: string;
  resolveDisplayValue: () => Promise<string>;
  storeValue: (value: string) => void;
  resetValue: () => void;
  getThemeName?: () => string;
}

function bindThemeBoundColorInput(options: ThemeBoundColorInputOptions): void {
  const {
    host,
    input,
    popoverTitle,
    resolveDisplayValue,
    storeValue,
    resetValue,
    getThemeName,
  } = options;

  void resolveDisplayValue().then((value) => {
    input.value = value;
  });

  input.addEventListener("input", () => {
    storeValue(input.value);
  });

  attachThemeColorPopover(
    host,
    input,
    popoverTitle,
    (value) => {
      input.value = value;
      storeValue(value);
    },
    () => {
      void resolveDisplayValue().then((value) => {
        input.value = value;
        resetValue();
      });
    },
    getThemeName,
  );

  input.addEventListener("dblclick", (e) => {
    e.preventDefault();
    if (host.syncing) return;
    void resolveDisplayValue().then((value) => {
      input.value = value;
      resetValue();
    });
  });
}

function describeSemanticField(
  group: keyof typeof COVER_SEMANTIC_SCHEMA,
  field: string,
  fallback: string,
): string {
  const meta = (COVER_SEMANTIC_SCHEMA[group].fields as Record<string, { description: string; appliesWhen?: string; followsThemeWhenEmpty?: boolean; relatedFields?: readonly string[] }>)[field];
  if (!meta) return fallback;
  const extras: string[] = [];
  if (meta.appliesWhen) extras.push(`生效条件: ${meta.appliesWhen}`);
  if (meta.followsThemeWhenEmpty) extras.push("留空时跟随当前 theme");
  if (meta.relatedFields?.length) extras.push(`相关字段: ${meta.relatedFields.join(", ")}`);
  return [meta.description, ...extras].join("；");
}

function createCoverParamRow(parent: HTMLElement, label: string, visible: boolean): HTMLElement {
  const row = parent.createDiv("nr-row");
  row.createEl("span", { cls: "nr-row-label", text: label });
  row.classList.toggle("nr-hidden", !visible);
  return row;
}

function setHoverHint(element: HTMLElement, hint: string): void {
  element.title = hint;
}

function bindBooleanChipToggle(
  host: PanelHost,
  toggle: HTMLElement,
  row: HTMLElement,
  key: "coverGlow" | "coverBanner" | "coverShadow",
): void {
  toggle.addEventListener("click", () => {
    if (host.syncing) return;
    const val = !Boolean(host.effective[key]);
    toggle.classList.toggle("active", val);
    row.classList.toggle("nr-hidden", !val);
    void host.updateSetting(key, val);
  });
}

interface GlowControlsResult {
  row: HTMLElement;
  input: HTMLInputElement;
  colorInput: HTMLInputElement;
}

function buildGlowControls(
  host: PanelHost,
  parent: HTMLElement,
  visible: boolean,
  resolveThemeColor: () => Promise<string>,
  themeNameProvider: () => string,
): GlowControlsResult {
  const row = createCoverParamRow(parent, "发光", visible);
  const input = makeDynamicNumberField(
    host,
    row,
    "光",
    String(host.effective.coverGlowSize),
    () => {
      const gs = FIELD_SCHEMAS.coverGlowSize;
      return { min: gs.min, max: gs.max, step: gs.step ?? 1, defaultValue: gs.default };
    },
    (val) => host.updateSetting("coverGlowSize", val),
  );

  const colorInput = row.createEl("input", { cls: "nr-color-dot", type: "color" });
  colorInput.value = parseColorValue(host.effective.coverGlowColor, host.effective.coverFontColor || "#e07c5a");
  colorInput.title = describeSemanticField("glow", "color", "发光颜色（双击跟随文字颜色）");
  bindThemeBoundColorInput({
    host,
    input: colorInput,
    popoverTitle: "发光颜色",
    resolveDisplayValue: async () => host.effective.coverGlowColor || host.effective.coverFontColor || await resolveThemeColor(),
    storeValue: (value) => { void host.updateSetting("coverGlowColor", value); },
    resetValue: () => { void host.updateSetting("coverGlowColor", ""); },
    getThemeName: themeNameProvider,
  });

  return { row, input, colorInput };
}

interface BannerControlsResult {
  row: HTMLElement;
}

function buildBannerControls(
  host: PanelHost,
  parent: HTMLElement,
  visible: boolean,
  themeNameProvider: () => string,
): BannerControlsResult {
  const row = createCoverParamRow(parent, "色带", visible);
  const colorInput = row.createEl("input", { cls: "nr-color-dot", type: "color" });
  colorInput.value = parseColorValue(host.effective.coverBannerColor, "#000000");

  const bannerAlpha = parseAlphaPercent(host.effective.coverBannerColor, 50);
  let currentAlpha = bannerAlpha / 100;

  const updateBannerColor = async () => {
    const rgba = buildRgba(colorInput.value, currentAlpha * 100);
    await host.updateSetting("coverBannerColor", rgba);
  };

  attachThemeColorPopover(
    host,
    colorInput,
    "色带颜色",
    (value) => {
      colorInput.value = value;
      void updateBannerColor();
    },
    undefined,
    themeNameProvider,
  );

  makeField(host, row, "", String(bannerAlpha),
    { min: 0, max: 100, step: 10, unit: "%" },
    async (val) => { currentAlpha = val / 100; await updateBannerColor(); });

  makeField(host, row, "斜", String(host.effective.coverBannerSkew),
    schemaOpts("coverBannerSkew"),
    (val) => host.updateSetting("coverBannerSkew", val));

  makeField(host, row, "宽", String(host.effective.coverBannerPaddingPercent),
    schemaOpts("coverBannerPaddingPercent"),
    (val) => host.updateSetting("coverBannerPaddingPercent", val));

  colorInput.addEventListener("input", () => { void updateBannerColor(); });

  return { row };
}

interface ShadowControlsResult {
  row: HTMLElement;
  blurInput: HTMLInputElement;
  colorInput: HTMLInputElement;
  alphaInput: HTMLInputElement;
}

function buildShadowControls(
  host: PanelHost,
  parent: HTMLElement,
  visible: boolean,
  themeNameProvider: () => string,
): ShadowControlsResult {
  const row = createCoverParamRow(parent, "投影", visible);

  const blurInput = makeField(host, row, "模糊", String(host.effective.coverShadowBlur),
    schemaOpts("coverShadowBlur"),
    (val) => host.updateSetting("coverShadowBlur", val));

  const colorInput = row.createEl("input", { cls: "nr-color-dot", type: "color" });
  colorInput.value = parseColorValue(host.effective.coverShadowColor, "#000000");
  colorInput.title = describeSemanticField("shadow", "color", "投影颜色（双击恢复默认）");

  let alphaInput: HTMLInputElement;
  const updateShadowColor = async () => {
    const alpha = parseInt(alphaInput.value) || 0;
    await host.updateSetting("coverShadowColor", buildRgba(colorInput.value, alpha));
  };

  attachThemeColorPopover(
    host,
    colorInput,
    "投影颜色",
    (value) => {
      colorInput.value = value;
      void updateShadowColor();
    },
    undefined,
    themeNameProvider,
  );

  alphaInput = makeField(host, row, "", String(parseAlphaPercent(host.effective.coverShadowColor, 60)),
    { min: 0, max: 100, step: 10, unit: "%" },
    async (val) => {
      await host.updateSetting("coverShadowColor", buildRgba(colorInput.value, val));
    });

  colorInput.addEventListener("input", () => { void updateShadowColor(); });
  colorInput.addEventListener("dblclick", (e) => {
    e.preventDefault();
    if (host.syncing) return;
    colorInput.value = "#000000";
    alphaInput.value = "60";
    void host.updateSetting("coverShadowColor", "rgba(0,0,0,0.6)");
  });

  makeField(host, row, "X", String(host.effective.coverShadowOffsetX),
    schemaOpts("coverShadowOffsetX"),
    (val) => host.updateSetting("coverShadowOffsetX", val));

  makeField(host, row, "Y", String(host.effective.coverShadowOffsetY),
    schemaOpts("coverShadowOffsetY"),
    (val) => host.updateSetting("coverShadowOffsetY", val));

  return { row, blurInput, colorInput, alphaInput };
}

interface StrokeControlsResult {
  row: HTMLElement;
  styleSelect: HTMLSelectElement;
  strokeInput: HTMLInputElement;
  opacityInput: HTMLInputElement;
  doubleStrokeInput: HTMLInputElement;
  strokeColorInput: HTMLInputElement;
  doubleStrokeColorInput: HTMLInputElement;
  doubleStrokeField: HTMLElement;
  doubleStrokeColorField: HTMLElement;
}

interface StrokeControlsOptions {
  host: PanelHost;
  parent: HTMLElement;
  visible: boolean;
  initialStyle: import("./constants").CoverStrokeStyle;
  themeNameProvider: () => string;
  resolveStrokePalette: () => Promise<import("./effects").CoverStrokePalette>;
}

function buildStrokeControls(options: StrokeControlsOptions): StrokeControlsResult {
  const { host, parent, visible, initialStyle, themeNameProvider, resolveStrokePalette } = options;
  const row = createCoverParamRow(parent, "描边", visible);

  const styleSelect = row.createEl("select", { cls: "dropdown nr-dropdown-narrow" });
  [
    { label: "描边", value: "stroke" },
    { label: "双描边", value: "double" },
    { label: "镂空", value: "hollow" },
  ].forEach((s) => styleSelect.createEl("option", { text: s.label, value: s.value }));
  styleSelect.value = initialStyle;

  const currentStrokeStyle = (): import("./constants").CoverStrokeStyle => {
    const value = styleSelect.value || host.effective.coverStrokeStyle;
    return value as import("./constants").CoverStrokeStyle;
  };

  const strokeLimits = (style: import("./constants").CoverStrokeStyle): { min: number; max: number; step: number } => {
    const schema = COVER_STROKE_STYLE_UI[style] ?? COVER_STROKE_STYLE_UI.stroke;
    return schema.stroke;
  };

  const strokeColorInput = row.createEl("input", { cls: "nr-color-dot", type: "color" });
  strokeColorInput.value = "#000000";
  strokeColorInput.title = describeSemanticField("stroke", "innerColor", "描边颜色（双击跟随主题标题色）");
  bindThemeBoundColorInput({
    host,
    input: strokeColorInput,
    popoverTitle: "描边颜色",
    resolveDisplayValue: async () => {
      const palette = await resolveStrokePalette();
      return parseColorValue(host.effective.coverStrokeColor, palette.inner);
    },
    storeValue: (value) => { void host.updateSetting("coverStrokeColor", value); },
    resetValue: () => { void host.updateSetting("coverStrokeColor", ""); },
    getThemeName: themeNameProvider,
  });

  const doubleStrokeColorInput = row.createEl("input", { cls: "nr-color-dot", type: "color" });
  doubleStrokeColorInput.value = parseColorValue(host.effective.coverDoubleStrokeColor, host.effective.coverFontColor || "#e07c5a");
  doubleStrokeColorInput.title = describeSemanticField("stroke", "outerColor", "外描边颜色（双击跟随 theme 默认）");
  bindThemeBoundColorInput({
    host,
    input: doubleStrokeColorInput,
    popoverTitle: "外描边颜色",
    resolveDisplayValue: async () => {
      const palette = await resolveStrokePalette();
      return host.effective.coverDoubleStrokeColor
        ? parseColorValue(host.effective.coverDoubleStrokeColor, palette.outer)
        : palette.outer;
    },
    storeValue: (value) => { void host.updateSetting("coverDoubleStrokeColor", value); },
    resetValue: () => { void host.updateSetting("coverDoubleStrokeColor", ""); },
    getThemeName: themeNameProvider,
  });

  const strokeInput = makeDynamicNumberField(
    host,
    row,
    "内粗",
    String(host.effective.coverStrokePercent),
    () => {
      const limits = strokeLimits(currentStrokeStyle());
      return { ...limits, defaultValue: FIELD_SCHEMAS.coverStrokePercent.default };
    },
    (val) => host.updateSetting("coverStrokePercent", val),
  );

  const opacityInput = makeField(host, row, "透明", String(host.effective.coverStrokeOpacity),
    { ...schemaOpts("coverStrokeOpacity"), step: 10 },
    (val) => host.updateSetting("coverStrokeOpacity", val));

  const doubleStrokeInput = makeDynamicNumberField(
    host,
    row,
    "外粗",
    String(host.effective.coverDoubleStrokePercent),
    () => {
      const ds = FIELD_SCHEMAS.coverDoubleStrokePercent;
      return { min: ds.min, max: ds.max, step: ds.step ?? 0.5, defaultValue: ds.default };
    },
    (val) => host.updateSetting("coverDoubleStrokePercent", val),
  );

  const doubleStrokeField = doubleStrokeInput.parentElement as HTMLElement;
  const doubleStrokeColorField = doubleStrokeColorInput;

  const updateUi = (style: import("./constants").CoverStrokeStyle) => {
    const semanticValues = {
      ...host.effective,
      coverStrokeStyle: style,
    };
    doubleStrokeField.classList.toggle("nr-hidden", !isCoverSemanticFieldActive("stroke", "outerWidth", semanticValues));
    doubleStrokeColorField.classList.toggle("nr-hidden", !isCoverSemanticFieldActive("stroke", "outerColor", semanticValues));
    opacityInput.parentElement?.classList.toggle("nr-hidden", !isCoverSemanticFieldActive("stroke", "opacity", semanticValues));
    const limits = strokeLimits(style);
    const current = parseFloat(strokeInput.value) || 0;
    strokeInput.value = String(Math.max(limits.min, Math.min(limits.max, current)));
  };

  const applyStylePreset = async (style: import("./constants").CoverStrokeStyle): Promise<void> => {
    const palette = await resolveStrokePalette();
    const preset = COVER_STROKE_STYLE_UI[style];
    if (!preset) return;

    strokeInput.value = String(preset.stroke.default);
    strokeColorInput.value = palette.inner;

    if (preset.doubleStroke) {
      doubleStrokeInput.value = String(preset.doubleStroke.default);
      doubleStrokeColorInput.value = palette.outer;
    }
  };

  styleSelect.addEventListener("change", () => { void (async () => {
    if (host.syncing) return;
    const style = styleSelect.value as import("./constants").CoverStrokeStyle;
    host.lastStrokeStyle = style;
    const preset = COVER_STROKE_STYLE_UI[style];
    const newPercent = preset?.stroke.default ?? FIELD_SCHEMAS.coverStrokePercent.default;
    const newOuterPercent = preset?.doubleStroke?.default ?? FIELD_SCHEMAS.coverDoubleStrokePercent.default;
    await applyStylePreset(style);
    updateUi(style);
    host.plugin.setFallbackRenderValue("coverStrokeStyle", style);
    host.plugin.setFallbackRenderValue("coverStrokePercent", newPercent);
    if (style === "double") {
      host.plugin.setFallbackRenderValue("coverDoubleStrokePercent", newOuterPercent);
      host.plugin.setFallbackRenderValue("coverDoubleStrokeColor", "");
    }
    if (style === "stroke" || style === "double" || style === "hollow") {
      host.plugin.setFallbackRenderValue("coverStrokeColor", "");
    }
    await host.refresh();
  })(); });

  updateUi(initialStyle);

  return {
    row,
    styleSelect,
    strokeInput,
    opacityInput,
    doubleStrokeInput,
    strokeColorInput,
    doubleStrokeColorInput,
    doubleStrokeField,
    doubleStrokeColorField,
  };
}

interface CoverEffectControlsResult {
  strokeParamsRow: HTMLElement;
  strokeStyleSelect: HTMLSelectElement;
  strokeInput: HTMLInputElement;
  opInput: HTMLInputElement;
  doubleStrokeInput: HTMLInputElement;
  strokeColorInput: HTMLInputElement;
  doubleStrokeColorInput: HTMLInputElement;
  doubleStrokeField: HTMLElement;
  doubleStrokeColorField: HTMLElement;
  glowParamsRow: HTMLElement;
  glowInput: HTMLInputElement;
  glowColorInput: HTMLInputElement;
  bannerParamsRow: HTMLElement;
  shadowParamsRow: HTMLElement;
  blurInput: HTMLInputElement;
  shadowColorInput: HTMLInputElement;
  shadowAlphaInput: HTMLInputElement;
}

interface CoverEffectControlsOptions {
  host: PanelHost;
  parent: HTMLElement;
  themeNameProvider: () => string;
  resolveThemeColor: () => Promise<string>;
  resolveStrokePalette: () => Promise<import("./effects").CoverStrokePalette>;
  strokeToggle: HTMLElement;
  glowToggle: HTMLElement;
  bannerToggle: HTMLElement;
  shadowToggle: HTMLElement;
  presetSelect: HTMLSelectElement;
}

function buildCoverEffectControls(options: CoverEffectControlsOptions): CoverEffectControlsResult {
  const {
    host,
    parent,
    themeNameProvider,
    resolveThemeColor,
    resolveStrokePalette,
    strokeToggle,
    glowToggle,
    bannerToggle,
    shadowToggle,
    presetSelect,
  } = options;

  const strokeEnabled = host.effective.coverStrokeStyle !== "none";
  const glowEnabled = host.effective.coverGlow === true;

  const strokeControls = buildStrokeControls({
    host,
    parent,
    visible: strokeEnabled,
    initialStyle: (strokeEnabled ? host.effective.coverStrokeStyle : host.lastStrokeStyle) as import("./constants").CoverStrokeStyle,
    themeNameProvider,
    resolveStrokePalette,
  });

  const glowControls = buildGlowControls(
    host,
    parent,
    glowEnabled,
    resolveThemeColor,
    themeNameProvider,
  );

  strokeToggle.addEventListener("click", () => { void (async () => {
    if (host.syncing) return;
    const currentStyle = host.effective.coverStrokeStyle;
    if (currentStyle !== "none") {
      host.lastStrokeStyle = currentStyle;
      strokeToggle.classList.remove("active");
      strokeControls.row.classList.add("nr-hidden");
      await host.updateSetting("coverStrokeStyle", "none");
    } else {
      strokeToggle.classList.add("active");
      strokeControls.row.classList.remove("nr-hidden");
      strokeControls.styleSelect.value = host.lastStrokeStyle;
      await host.updateSetting("coverStrokeStyle", host.lastStrokeStyle as import("./constants").CoverStrokeStyle);
    }
  })(); });

  const bannerControls = buildBannerControls(
    host,
    parent,
    Boolean(host.effective.coverBanner),
    themeNameProvider,
  );
  const shadowControls = buildShadowControls(
    host,
    parent,
    Boolean(host.effective.coverShadow),
    themeNameProvider,
  );

  bindBooleanChipToggle(host, shadowToggle, shadowControls.row, "coverShadow");
  bindBooleanChipToggle(host, glowToggle, glowControls.row, "coverGlow");
  bindBooleanChipToggle(host, bannerToggle, bannerControls.row, "coverBanner");

  return {
    strokeParamsRow: strokeControls.row,
    strokeStyleSelect: strokeControls.styleSelect,
    strokeInput: strokeControls.strokeInput,
    opInput: strokeControls.opacityInput,
    doubleStrokeInput: strokeControls.doubleStrokeInput,
    strokeColorInput: strokeControls.strokeColorInput,
    doubleStrokeColorInput: strokeControls.doubleStrokeColorInput,
    doubleStrokeField: strokeControls.doubleStrokeField,
    doubleStrokeColorField: strokeControls.doubleStrokeColorField,
    glowParamsRow: glowControls.row,
    glowInput: glowControls.input,
    glowColorInput: glowControls.colorInput,
    bannerParamsRow: bannerControls.row,
    shadowParamsRow: shadowControls.row,
    blurInput: shadowControls.blurInput,
    shadowColorInput: shadowControls.colorInput,
    shadowAlphaInput: shadowControls.alphaInput,
  };
}

let activeColorPopover: HTMLElement | null = null;
let activeColorPopoverCleanup: (() => void) | null = null;

function closeColorPopover(): void {
  activeColorPopover?.remove();
  activeColorPopover = null;
  activeColorPopoverCleanup?.();
  activeColorPopoverCleanup = null;
}

async function getThemeColorChoices(host: PanelHost, themeName?: string): Promise<ThemeColorChoice[]> {
  const css = await host.plugin.loadTheme(themeName || host.effective.activeTheme);
  return extractThemeColorChoices(css, themeName);
}

function openColorPopover(
  trigger: HTMLElement,
  title: string,
  choices: ThemeColorChoice[],
  onPick: (value: string) => void,
  onCustom: () => void,
  onFollow?: () => void,
): void {
  closeColorPopover();

  const pop = document.createElement("div");
  pop.className = "nr-color-popover";
  pop.createEl("div", { cls: "nr-color-popover-title", text: title });

  for (const choice of choices) {
    const btn = pop.createEl("button", { cls: "nr-color-choice", attr: { type: "button" } });
    btn.createEl("span", { cls: "nr-color-choice-swatch" }).style.background = choice.value;
    btn.createEl("span", { cls: "nr-color-choice-label", text: choice.label });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      onPick(choice.value);
      closeColorPopover();
    });
  }

  const actions = pop.createDiv("nr-color-popover-actions");
  if (onFollow) {
    const followBtn = actions.createEl("button", { cls: "nr-text-btn", text: "跟随", attr: { type: "button" } });
    followBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onFollow();
      closeColorPopover();
    });
  }
  const customBtn = actions.createEl("button", { cls: "nr-text-btn", text: "自定义…", attr: { type: "button" } });
  customBtn.addEventListener("click", (e) => {
    e.preventDefault();
    onCustom();
    closeColorPopover();
  });

  document.body.appendChild(pop);
  const rect = trigger.getBoundingClientRect();
  const top = Math.min(window.innerHeight - 16, rect.bottom + 8);
  const left = Math.min(window.innerWidth - 220, Math.max(12, rect.left));
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;

  const handlePointer = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (pop.contains(target) || trigger.contains(target)) return;
    closeColorPopover();
  };
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") closeColorPopover();
  };

  document.addEventListener("mousedown", handlePointer, true);
  document.addEventListener("keydown", handleEscape, true);
  activeColorPopover = pop;
  activeColorPopoverCleanup = () => {
    document.removeEventListener("mousedown", handlePointer, true);
    document.removeEventListener("keydown", handleEscape, true);
  };
}

function attachThemeColorPopover(
  host: PanelHost,
  trigger: HTMLInputElement,
  title: string,
  onPick: (value: string) => void,
  onFollow?: () => void,
  getThemeName?: () => string,
): void {
  const nativePicker = document.createElement("input");
  nativePicker.type = "color";
  nativePicker.className = "nr-hidden";
  trigger.insertAdjacentElement("afterend", nativePicker);

  nativePicker.addEventListener("input", () => {
    onPick(nativePicker.value);
  });

  trigger.addEventListener("pointerdown", (e) => {
    e.preventDefault();
  });
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void getThemeColorChoices(host, getThemeName?.()).then((choices) => {
      nativePicker.value = trigger.value;
      openColorPopover(
        trigger,
        title,
        choices,
        onPick,
        () => {
          nativePicker.value = trigger.value;
          const picker = nativePicker as HTMLInputElement & { showPicker?: () => void };
          if (typeof picker.showPicker === "function") {
            picker.showPicker();
          } else {
            nativePicker.click();
          }
        },
        onFollow,
      );
    });
  });
}

// ── Panel builder ───────────────────────────────────────────────────────────

export function buildSettingsPanel(host: PanelHost, contentEl: HTMLElement): PanelRefs {
  contentEl.empty();
  contentEl.classList.add("nr-view");

  // ── Top bar: 预设 (compact) ──
  const presetBar = contentEl.createDiv("nr-top-bar");
  presetBar.createEl("span", { cls: "nr-row-label", text: "预设" });
  const configSourceBadge = presetBar.createDiv({ cls: "nr-config-source-badge", text: "默认值" });
  const presetSelect = presetBar.createEl("select", { cls: "dropdown" });
  // Populate preset options directly (refs not yet available, can't call host.rebuildPresetOptions)
  presetSelect.createEl("option", { text: "(无预设)", value: "" });
  for (const name of host.plugin.getPresetNames()) {
    presetSelect.createEl("option", { text: host.plugin.getPresetDisplayName(name), value: name });
  }
  const presetLockBtn = presetBar.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-text nr-preset-lock-btn", text: "🔓" });
  const syncPresetLockButton = () => {
    const name = host.plugin.getActivePresetName();
    const locked = name ? host.plugin.isPresetLocked(name) : false;
    presetLockBtn.textContent = locked ? "🔒" : "🔓";
    presetLockBtn.title = name ? (locked ? `解锁预设「${name}」` : `锁定预设「${name}」`) : "先选择一个预设";
    presetLockBtn.disabled = !name;
    presetLockBtn.classList.toggle("is-disabled", !name);
  };
  presetSelect.value = host.plugin.getActivePresetName();
  presetSelect.addEventListener("change", () => { void (async () => {
    if (host.syncing) return;
    const name = presetSelect.value;
    if (name) {
      await host.applyPreset(name);
    } else {
      await host.clearPresetSelection();
    }
    syncPresetLockButton();
    await host.refresh();
  })(); });
  presetLockBtn.addEventListener("click", () => { void (async () => {
    const name = host.plugin.getActivePresetName();
    if (!name) { new Notice("没有选中预设"); return; }
    const locked = host.plugin.togglePresetLock(name);
    await host.plugin.saveSettings();
    host.rebuildPresetOptions();
    const selectedOpt = presetSelect.querySelector<HTMLOptionElement>(`option[value="${CSS.escape(name)}"]`);
    if (selectedOpt) {
      selectedOpt.text = host.plugin.getPresetDisplayName(name);
    }
    syncPresetLockButton();
    new Notice(`预设「${name}」已${locked ? "锁定" : "解锁"}`);
    await host.refresh();
  })(); });

  const presetActions = presetBar.createDiv("nr-segmented nr-top-actions");
  const presetSaveBtn = presetActions.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-text", text: "保存" });
  presetSaveBtn.title = "保存当前配置为预设";
  presetSaveBtn.addEventListener("click", () => {
    new InputModal(host.app, "保存预设", host.plugin.getActivePresetName() || "", (name) => {
      if (!name) return;
      if (!host.plugin.savePreset(name, host.effective)) {
        new Notice(`预设「${name}」已锁定，需先解锁才能覆盖`);
        return;
      }
      void host.plugin.saveSettings();
      host.rebuildPresetOptions();
      syncPresetLockButton();
      new Notice(`预设「${name}」已保存`);
    }).open();
  });

  const presetDelBtn = presetActions.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-text", text: "删除" });
  presetDelBtn.title = "删除当前预设";
  presetDelBtn.addEventListener("click", () => {
    const name = host.plugin.getActivePresetName();
    if (!name) { new Notice("没有选中预设"); return; }
    new ConfirmModal(host.app, `删除预设「${name}」？`, (confirmed) => {
      if (!confirmed) return;
      host.plugin.deletePreset(name);
      void (async () => {
        await host.plugin.saveSettings();
        host.rebuildPresetOptions();
        syncPresetLockButton();
        new Notice(`预设「${name}」已删除`);
        await host.refresh();
      })();
    }).open();
  });
  const presetApplyBtn = presetActions.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-text", text: "应用" });
  presetApplyBtn.title = "将当前选中的预设重新应用到工作态";
  presetApplyBtn.addEventListener("click", () => { void (async () => {
    const name = presetSelect.value || host.plugin.getActivePresetName();
    if (!name) { new Notice("没有选中预设"); return; }
    await host.applyPreset(name);
    syncPresetLockButton();
    await host.refresh();
  })(); });
  syncPresetLockButton();

  // ── Quick bar: 主题 + 模式 ──
  const quickBar = contentEl.createDiv("nr-quick-bar");
  quickBar.createEl("span", { cls: "nr-row-label", text: "主题" });
  const themeSelect = quickBar.createEl("select", { cls: "dropdown" });
  host.plugin.getThemeNames().forEach((name) => {
    themeSelect.createEl("option", { text: name, value: name });
  });
  themeSelect.value = host.effective.activeTheme;
  themeSelect.addEventListener("change", () => { void (async () => {
    if (host.syncing) return;
    closeColorPopover();
    await host.updateSetting("activeTheme", themeSelect.value);
  })(); });

  // Mode toggle buttons (mutually exclusive, pushed right)
  quickBar.createDiv({ cls: "nr-flex-spacer" });
  const modeGroup = quickBar.createDiv("nr-segmented nr-quick-segmented");
  const modeBtn35 = modeGroup.createEl("button", {
    cls: `nr-btn nr-btn-sm nr-btn-text${host.effective.pageMode === "long" ? " nr-btn-active" : ""}`,
    text: "3:5",
  });
  const modeBtn34 = modeGroup.createEl("button", {
    cls: `nr-btn nr-btn-sm nr-btn-text${host.effective.pageMode === "card" ? " nr-btn-active" : ""}`,
    text: "3:4",
  });

  const setMode = async (mode: "long" | "card") => {
    if (host.syncing) return;
    modeBtn35.classList.toggle("nr-btn-active", mode === "long");
    modeBtn34.classList.toggle("nr-btn-active", mode === "card");
    await host.updateSetting("pageMode", mode);
  };
  modeBtn35.addEventListener("click", () => { void setMode("long"); });
  modeBtn34.addEventListener("click", () => { void setMode("card"); });

  // Keep a hidden select for syncUI compatibility
  const modeSelect = document.createElement("select");
  modeSelect.classList.add("nr-hidden");
  modeSelect.createEl("option", { text: "长文 3:5", value: "long" });
  modeSelect.createEl("option", { text: "图文 3:4", value: "card" });
  modeSelect.value = host.effective.pageMode;

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
  rebuildFontOptions(coverFontSelect, getCoverFontList(host.plugin.getCustomFonts()), host.effective.coverFontFamily);
  coverFontSelect.addEventListener("click", (e) => e.stopPropagation());
  coverFontSelect.addEventListener("change", () => { void (async () => {
    if (host.syncing) return;
    await host.updateSetting("coverFontFamily", coverFontSelect.value);
  })(); });

  // Font manager gear button (cover) — will be wired up after fontSelect is created below
  const coverFontGearBtn = coverHeadControls.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-text", text: "⚙" });
  coverFontGearBtn.title = "管理自定义字体";
  coverFontGearBtn.addEventListener("click", (e) => e.stopPropagation());

  const scaleInput = coverHeadControls.createEl("input", { cls: "nr-size-input", type: "text" });
  scaleInput.value = String(host.effective.coverFontScale);
  scaleInput.addEventListener("click", (e) => e.stopPropagation());
  const cfs = FIELD_SCHEMAS.coverFontScale;
  const applyScale = async () => {
    if (host.syncing) return;
    const val = Math.max(cfs.min, Math.min(cfs.max, parseInt(scaleInput.value) || cfs.default));
    scaleInput.value = String(val);
    await host.updateSetting("coverFontScale", val);
  };
  scaleInput.addEventListener("blur", () => { void applyScale(); });
  scaleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); void applyScale(); } });
  scaleInput.addEventListener("wheel", (e) => {
    if (document.activeElement !== scaleInput) return;
    e.preventDefault();
    const cur = parseInt(scaleInput.value) || cfs.default;
    const val = Math.max(cfs.min, Math.min(cfs.max, cur + (e.deltaY < 0 ? (cfs.step ?? 10) : -(cfs.step ?? 10))));
    scaleInput.value = String(val);
    void host.updateSetting("coverFontScale", val);
  }, { passive: false });
  coverHeadControls.createEl("span", { cls: "nr-size-unit", text: "%" });

  // Align buttons (independent)
  const alignDefs: { key: "left" | "center" | "right"; title: string; icon: string }[] = [
    { key: "left",   title: "左对齐", icon: "align-left" },
    { key: "center", title: "居中",   icon: "align-center" },
    { key: "right",  title: "右对齐", icon: "align-right" },
  ];
  const alignBtns: Record<string, HTMLElement> = {};
  const alignGroup = coverHeadControls.createDiv("nr-header-align");
  alignDefs.forEach((def) => {
    const btn = alignGroup.createEl("button", {
      cls: (host.effective.coverTextAlign ?? "left") === def.key ? "active" : "",
    });
    btn.title = def.title;
    setIcon(btn, def.icon);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (host.syncing) return;
      Object.values(alignBtns).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      void host.updateSetting("coverTextAlign", def.key);
    });
    alignBtns[def.key] = btn;
  });

  coverTextHead.addEventListener("click", () => toggleSection(coverTextSection));

  // ── Section body ──
  const coverTextBody = coverTextSection.createDiv("nr-section-body");

  // Text effect chips: 描边 / 发光 / 色带 / 投影
  host.lastStrokeStyle = host.effective.coverStrokeStyle !== "none" ? host.effective.coverStrokeStyle : "stroke";
  const strokeEnabled = host.effective.coverStrokeStyle !== "none";
  const glowEnabled = host.effective.coverGlow === true;

  const textEffectRow = coverTextBody.createDiv("nr-row");
  textEffectRow.createEl("span", { cls: "nr-row-label", text: "效果" });
  setHoverHint(textEffectRow, "影响封面文字的强调方式和文字特效");
  const strokeToggle = textEffectRow.createEl("span", { cls: `nr-chip${strokeEnabled ? " active" : ""}`, text: "描边" });
  const glowToggle = textEffectRow.createEl("span", { cls: `nr-chip${glowEnabled ? " active" : ""}`, text: "发光" });
  const bannerToggle = textEffectRow.createEl("span", { cls: `nr-chip${host.effective.coverBanner ? " active" : ""}`, text: "色带" });
  const shadowToggle = textEffectRow.createEl("span", { cls: `nr-chip${host.effective.coverShadow ? " active" : ""}`, text: "投影" });
  setHoverHint(strokeToggle, "给封面文字加描边，增强边界和层次");
  setHoverHint(glowToggle, "给封面文字加发光，适合图片封面或夜景氛围");
  setHoverHint(bannerToggle, "在文字背后加色带，适合强调一句标题");
  setHoverHint(shadowToggle, "给文字加投影，提升立体感和可读性");

  textEffectRow.createDiv("nr-flex-spacer");
  const markStyleGroup = textEffectRow.createDiv("nr-segmented");
  const markBtnMarker = markStyleGroup.createEl("button", {
    cls: `nr-btn nr-btn-sm nr-btn-text${(host.effective.coverMarkStyle ?? "marker") === "marker" ? " nr-btn-active" : ""}`,
    text: "荧光",
  });
  const markBtnBlock = markStyleGroup.createEl("button", {
    cls: `nr-btn nr-btn-sm nr-btn-text${host.effective.coverMarkStyle === "block" ? " nr-btn-active" : ""}`,
    text: "底块",
  });
  const markBtnUnderline = markStyleGroup.createEl("button", {
    cls: `nr-btn nr-btn-sm nr-btn-text${host.effective.coverMarkStyle === "underline" ? " nr-btn-active" : ""}`,
    text: "底线",
  });
  setHoverHint(markStyleGroup, "影响封面中 <mark> / ==关键词== 的高亮表现");
  const setCoverMarkStyle = async (style: "marker" | "block" | "underline") => {
    if (host.syncing) return;
    markBtnMarker.classList.toggle("nr-btn-active", style === "marker");
    markBtnBlock.classList.toggle("nr-btn-active", style === "block");
    markBtnUnderline.classList.toggle("nr-btn-active", style === "underline");
    await host.updateSetting("coverMarkStyle", style);
  };
  markBtnMarker.addEventListener("click", () => { void setCoverMarkStyle("marker"); });
  markBtnBlock.addEventListener("click", () => { void setCoverMarkStyle("block"); });
  markBtnUnderline.addEventListener("click", () => { void setCoverMarkStyle("underline"); });

  // Combined row: color + weight + spacing + line height
  const styleRow = coverTextBody.createDiv("nr-row");
  styleRow.createEl("span", { cls: "nr-row-label", text: "样式" });
  setHoverHint(styleRow, "影响封面文字本身的颜色、透明度、字重、字距和行高");

  const colorInput = styleRow.createEl("input", { cls: "nr-color-dot", type: "color" });
  // Resolve display color: saved value → theme default → fallback
  const resolveThemeColor = async (): Promise<string> => {
    const themeName = themeSelect.value || host.effective.activeTheme;
    const css = await host.plugin.loadTheme(themeName);
    return extractCoverTitleColor(css, themeName) || "#e07c5a";
  };
  const resolveStrokePalette = async (): Promise<import("./effects").CoverStrokePalette> => {
    const themeName = themeSelect.value || host.effective.activeTheme;
    const css = await host.plugin.loadTheme(themeName);
    return deriveCoverStrokePalette(css, themeName);
  };
  void resolveThemeColor().then(c => {
    colorInput.value = host.effective.coverFontColor || c;
  });
  colorInput.title = describeSemanticField("typography", "color", "封面文字颜色（双击重置为主题默认）");
  bindThemeBoundColorInput({
    host,
    input: colorInput,
    popoverTitle: "封面文字颜色",
    resolveDisplayValue: async () => host.effective.coverFontColor || await resolveThemeColor(),
    storeValue: (value) => { void host.updateSetting("coverFontColor", value); },
    resetValue: () => { void host.updateSetting("coverFontColor", ""); },
    getThemeName: () => themeSelect.value,
  });

  const coverOpacityInput = makeField(host, styleRow, "透明", String(host.effective.coverFontOpacity ?? 100),
    schemaOpts("coverFontOpacity"),
    (val) => host.updateSetting("coverFontOpacity", val));

  const weightSelect = styleRow.createEl("select", { cls: "dropdown nr-dropdown-narrow" });
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
  weightSelect.value = String(host.effective.coverFontWeight ?? 800);
  weightSelect.addEventListener("change", () => {
    if (host.syncing) return;
    void host.updateSetting("coverFontWeight", parseInt(weightSelect.value));
  });

  const lsInput = makeField(host, styleRow, "间距", String(host.effective.coverLetterSpacing),
    schemaOpts("coverLetterSpacing"),
    (val) => host.updateSetting("coverLetterSpacing", val));

  const lhSchema = schemaOpts("coverLineHeight");
  const lhInput = makeField(host, styleRow, "行高", String(host.effective.coverLineHeight),
    lhSchema,
    (val) => host.updateSetting("coverLineHeight", val));

  // Position row
  const posRow = coverTextBody.createDiv("nr-row");
  posRow.createEl("span", { cls: "nr-row-label", text: "位置" });
  setHoverHint(posRow, "影响封面文字在页面中的偏移和可用宽度");

  const oxInput = makeField(host, posRow, "X", String(host.effective.coverOffsetX),
    schemaOpts("coverOffsetX"),
    (val) => host.updateSetting("coverOffsetX", val));

  const oyInput = makeField(host, posRow, "Y", String(host.effective.coverOffsetY),
    schemaOpts("coverOffsetY"),
    (val) => host.updateSetting("coverOffsetY", val));

  const coverPaddingMode = host.effective.pageMode === "long" ? "long" : "card";
  const coverPaddingInput = makeField(host, posRow, "边距", String(host.effective.coverPagePaddingX ?? getDefaultCoverPaddingX(coverPaddingMode)),
    schemaOpts("coverPagePaddingX"),
    (val) => host.updateSetting("coverPagePaddingX", val));

  const coverEffectControls = buildCoverEffectControls({
    host,
    parent: coverTextBody,
    themeNameProvider: () => themeSelect.value,
    resolveThemeColor,
    resolveStrokePalette,
    strokeToggle,
    glowToggle,
    bannerToggle,
    shadowToggle,
    presetSelect,
  });
  const strokeParamsRow = coverEffectControls.strokeParamsRow;
  const strokeStyleSelect = coverEffectControls.strokeStyleSelect;
  const strokeInput = coverEffectControls.strokeInput;
  const opInput = coverEffectControls.opInput;
  const doubleStrokeInput = coverEffectControls.doubleStrokeInput;
  const glowInput = coverEffectControls.glowInput;
  const strokeColorInput = coverEffectControls.strokeColorInput;
  const doubleStrokeColorInput = coverEffectControls.doubleStrokeColorInput;
  const glowColorInput = coverEffectControls.glowColorInput;
  const blurInput = coverEffectControls.blurInput;
  const shadowColorInput = coverEffectControls.shadowColorInput;
  const shadowAlphaInput = coverEffectControls.shadowAlphaInput;
  const doubleStrokeField = coverEffectControls.doubleStrokeField;
  const doubleStrokeColorField = coverEffectControls.doubleStrokeColorField;
  const glowParamsRow = coverEffectControls.glowParamsRow;
  const bannerParamsRow = coverEffectControls.bannerParamsRow;
  const shadowParamsRow = coverEffectControls.shadowParamsRow;

  // ── Section: 封面效果 (decorative overlays only) ──
  const effectSection = coverSection.createDiv("nr-section");
  const effectHead = effectSection.createDiv("nr-section-head");
  effectHead.createEl("span", { cls: "nr-section-chevron", text: "▶" });
  effectHead.createEl("span", { cls: "nr-section-title", text: "封面效果" });
  setHoverHint(effectHead, "影响封面背景和装饰层，不直接改变文字样式");

  const effects = host.effective.coverEffects ?? RENDER_DEFAULTS.coverEffects;
  const effectBody = effectSection.createDiv("nr-section-body");
  const effectChipRow = effectBody.createDiv("nr-row");
  setHoverHint(effectChipRow, "给封面加背景装饰，例如网格、波点、斑驳光影等");
  const effectChips = effectChipRow.createDiv("nr-inline-tokens");
  const chipToggle = (parent: HTMLElement, label: string, effectName: string, active: boolean) => {
    const chip = parent.createEl("span", { cls: `nr-compact-token${active ? " active" : ""}`, text: label });
    const meta = EFFECT_SCHEMAS[effectName];
    if (meta?.description) setHoverHint(chip, meta.description);
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      if (host.syncing) return;
      const current = host.effective.coverEffects[effectName];
      const newEnabled = !current?.enabled;
      chip.classList.toggle("active", newEnabled);
      const updated = { ...host.effective.coverEffects, [effectName]: { ...current, enabled: newEnabled } };
      void host.updateSetting("coverEffects", updated);
    });
    return chip;
  };

  // Build effect chips from registry
  let overlayToggle: HTMLElement = null!;
  const coverEffectChipMap: Record<string, HTMLElement> = {};
  for (const [name, meta] of Object.entries(EFFECT_SCHEMAS)) {
    const chip = chipToggle(effectChips, meta.label, name, effects[name]?.enabled ?? false);
    coverEffectChipMap[name] = chip;
    if (name === "overlay") overlayToggle = chip;
  }

  effectHead.addEventListener("click", () => toggleSection(effectSection));

  // Build effect opacity rows from registry
  const coverEffectParamRows: Record<string, HTMLElement> = {};
  for (const [name, meta] of Object.entries(EFFECT_SCHEMAS)) {
    const params = effects[name];
    const row = effectBody.createDiv("nr-row");
    row.createEl("span", { cls: "nr-row-label", text: meta.label });
    if (meta.description) setHoverHint(row, meta.description);
    row.classList.toggle("nr-hidden", !params?.enabled);
    coverEffectParamRows[name] = row;
    makeField(host, row, "强度", String(params?.opacity ?? 50),
      { min: meta.min, max: meta.max, step: 10, unit: "%" },
      (val) => {
        const eff = host.effective.coverEffects ?? effects;
        const updated = { ...eff, [name]: { ...eff[name], opacity: val } };
        return host.updateSetting("coverEffects", updated);
      });
    if (meta.defaultMode != null && meta.modeOptions?.length) {
      const modeSelect = row.createEl("select", { cls: "dropdown nr-dropdown-narrow nr-effect-mode-select" });
      for (const option of meta.modeOptions) {
        modeSelect.createEl("option", { value: option.value, text: option.label });
      }
      modeSelect.value = params?.mode ?? meta.defaultMode;
      modeSelect.title = `${meta.label}模式`;
      modeSelect.addEventListener("change", () => {
        if (host.syncing) return;
        const eff = host.effective.coverEffects ?? effects;
        const updated = { ...eff, [name]: { ...eff[name], mode: modeSelect.value } };
        void host.updateSetting("coverEffects", updated);
      });
    }
    if (meta.defaultShape != null && meta.shapeOptions?.length) {
      const shapeSelect = row.createEl("select", { cls: "dropdown nr-dropdown-narrow nr-effect-shape-select" });
      for (const option of meta.shapeOptions) {
        shapeSelect.createEl("option", { value: option.value, text: option.label });
      }
      shapeSelect.value = params?.shape ?? meta.defaultShape;
      shapeSelect.title = `${meta.label}形状`;
      shapeSelect.addEventListener("change", () => {
        if (host.syncing) return;
        const eff = host.effective.coverEffects ?? effects;
        const updated = { ...eff, [name]: { ...eff[name], shape: shapeSelect.value } };
        void host.updateSetting("coverEffects", updated);
      });
    }
    if (meta.defaultCount != null) {
      makeField(host, row, "数量", String(params?.count ?? meta.defaultCount),
        { min: meta.countMin!, max: meta.countMax! },
        (val) => {
          const eff = host.effective.coverEffects ?? effects;
          const updated = { ...eff, [name]: { ...eff[name], count: val } };
          return host.updateSetting("coverEffects", updated);
        });
    }
    if (meta.defaultWidth != null) {
      makeField(host, row, "宽", String(params?.width ?? meta.defaultWidth),
        { min: meta.widthMin!, max: meta.widthMax!, step: meta.widthStep ?? 1 },
        (val) => {
          const eff = host.effective.coverEffects ?? effects;
          const updated = { ...eff, [name]: { ...eff[name], width: val } };
          return host.updateSetting("coverEffects", updated);
        });
    }
    if (meta.defaultSpacing != null) {
      makeField(host, row, "间距", String(params?.spacing ?? meta.defaultSpacing),
        { min: meta.spacingMin!, max: meta.spacingMax!, step: meta.spacingStep ?? 1, unit: "px" },
        (val) => {
          const eff = host.effective.coverEffects ?? effects;
          const updated = { ...eff, [name]: { ...eff[name], spacing: val } };
          return host.updateSetting("coverEffects", updated);
        });
    }
    if (meta.defaultSize != null) {
      makeField(host, row, "点", String(params?.size ?? meta.defaultSize),
        { min: meta.sizeMin!, max: meta.sizeMax!, step: meta.sizeStep ?? 1, unit: "px" },
        (val) => {
          const eff = host.effective.coverEffects ?? effects;
          const updated = { ...eff, [name]: { ...eff[name], size: val } };
          return host.updateSetting("coverEffects", updated);
        });
    }
    if (meta.defaultColor != null) {
      const colorInput = row.createEl("input", { cls: "nr-color-dot", type: "color" });
      colorInput.title = `${meta.label}颜色（双击跟随主题）`;
      void resolveEffectFallbackColor(host).then((fallbackColor) => {
        colorInput.value = parseColorValue(params?.color || "", fallbackColor);
      });
      bindThemeBoundColorInput({
        host,
        input: colorInput,
        popoverTitle: `${meta.label}颜色`,
        resolveDisplayValue: async () => {
          const eff = host.effective.coverEffects ?? effects;
          return eff[name]?.color || await resolveEffectFallbackColor(host);
        },
        storeValue: (value) => {
          const eff = host.effective.coverEffects ?? effects;
          const updated = { ...eff, [name]: { ...eff[name], color: value } };
          void host.updateSetting("coverEffects", updated);
        },
        resetValue: () => {
          const eff = host.effective.coverEffects ?? effects;
          const updated = { ...eff, [name]: { ...eff[name], color: "" } };
          void host.updateSetting("coverEffects", updated);
        },
        getThemeName: () => host.effective.activeTheme,
      });
    }
    // Wire chip toggle to show/hide this row
    const chips = effectChips.querySelectorAll(".nr-chip");
    for (const chip of chips) {
      if (chip.textContent === meta.label) {
        chip.addEventListener("click", () => {
          row.classList.toggle("nr-hidden", !chip.classList.contains("active"));
        });
      }
    }
  }

  // ── Body section: flat row (no accordion) ──
  const bodySection = contentEl.createDiv("nr-flat-row");
  bodySection.createEl("span", { cls: "nr-section-title", text: "正文" });

  const bodyControls = bodySection.createDiv("nr-header-controls");
  const fontSelect = bodyControls.createEl("select", { cls: "dropdown" });
  rebuildFontOptions(fontSelect, getBodyFontList(host.plugin.getCustomFonts()), host.effective.fontFamily);
  fontSelect.addEventListener("change", () => {
    if (host.syncing) return;
    void host.updateSetting("fontFamily", fontSelect.value);
  });

  // Shared font manager opener (used by both cover and body gear buttons)
  const openFontManager = () => {
    new FontManagerModal(host.app, host.plugin.getCustomFonts(), async (updated) => {
      host.plugin.setCustomFonts(updated);
      await host.plugin.saveSettings();
      rebuildFontOptions(coverFontSelect, getCoverFontList(updated), host.effective.coverFontFamily);
      rebuildFontOptions(fontSelect, getBodyFontList(updated), host.effective.fontFamily);
    }).open();
  };

  // Font manager gear button (body)
  const fontGearBtn = bodyControls.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-text", text: "⚙" });
  fontGearBtn.title = "管理自定义字体";
  fontGearBtn.addEventListener("click", openFontManager);

  // Wire up cover gear button (created earlier, before fontSelect existed)
  coverFontGearBtn.addEventListener("click", openFontManager);

  const sizeInput = bodyControls.createEl("input", { cls: "nr-size-input", type: "text" });
  sizeInput.value = String(host.effective.fontSize);
  const fs = FIELD_SCHEMAS.fontSize;
  const applySize = async () => {
    if (host.syncing) return;
    const val = Math.max(fs.min, Math.min(fs.max, parseInt(sizeInput.value) || fs.default));
    sizeInput.value = String(val);
    await host.updateSetting("fontSize", val);
  };
  sizeInput.addEventListener("blur", () => { void applySize(); });
  sizeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); void applySize(); } });
  sizeInput.addEventListener("wheel", (e) => {
    if (document.activeElement !== sizeInput) return;
    e.preventDefault();
    const cur = parseInt(sizeInput.value) || fs.default;
    const val = Math.max(fs.min, Math.min(fs.max, cur + (e.deltaY < 0 ? (fs.step ?? 2) : -(fs.step ?? 2))));
    sizeInput.value = String(val);
    void host.updateSetting("fontSize", val);
  }, { passive: false });
  // eslint-disable-next-line obsidianmd/ui/sentence-case -- Unit label, not sentence UI copy.
  bodyControls.createEl("span", { cls: "nr-size-unit", text: "px" });

  // List style toggle buttons
  const listGroup = bodyControls.createDiv("nr-segmented");
  const listBtnDefault = listGroup.createEl("button", {
    cls: `nr-btn nr-btn-sm nr-btn-text${host.effective.listStyle !== "capsule" ? " nr-btn-active" : ""}`,
    text: "列表",
  });
  const listBtnCapsule = listGroup.createEl("button", {
    cls: `nr-btn nr-btn-sm nr-btn-text${host.effective.listStyle === "capsule" ? " nr-btn-active" : ""}`,
    text: "胶囊",
  });
  const setListStyle = async (style: "default" | "capsule") => {
    if (host.syncing) return;
    listBtnDefault.classList.toggle("nr-btn-active", style === "default");
    listBtnCapsule.classList.toggle("nr-btn-active", style === "capsule");
    await host.updateSetting("listStyle", style);
  };
  listBtnDefault.addEventListener("click", () => { void setListStyle("default"); });
  listBtnCapsule.addEventListener("click", () => { void setListStyle("capsule"); });

  const bodyEffectsWrap = contentEl.createDiv("nr-section");
  const bodyEffectsHead = bodyEffectsWrap.createDiv("nr-section-head");
  bodyEffectsHead.createEl("span", { cls: "nr-section-chevron", text: "▶" });
  bodyEffectsHead.createEl("span", { cls: "nr-section-title", text: "正文效果" });
  const bodyEffectChipsWrap = bodyEffectsHead.createDiv("nr-header-chips");
  bodyEffectsHead.addEventListener("click", () => toggleSection(bodyEffectsWrap));

  const bodyEffects = host.effective.bodyEffects ?? RENDER_DEFAULTS.bodyEffects;
  const bodyEffectChips: Record<string, HTMLElement> = {};
  const bodyEffectParamRows: Record<string, HTMLElement> = {};
  for (const name of BODY_EFFECT_NAMES) {
    const meta = EFFECT_SCHEMAS[name];
    const chip = bodyEffectChipsWrap.createEl("span", {
      cls: `nr-chip${bodyEffects[name]?.enabled ? " active" : ""}`,
      text: meta.label,
    });
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      if (host.syncing) return;
      const eff = host.effective.bodyEffects ?? bodyEffects;
      const current = eff[name];
      const newEnabled = !(current?.enabled ?? false);
      chip.classList.toggle("active", newEnabled);
      const updated = { ...eff, [name]: { ...current, enabled: newEnabled } };
      void host.updateSetting("bodyEffects", updated);
    });
    bodyEffectChips[name] = chip;
  }
  const bodyEffectsBody = bodyEffectsWrap.createDiv("nr-section-body");
  for (const name of BODY_EFFECT_NAMES) {
    const meta = EFFECT_SCHEMAS[name];
    const params = bodyEffects[name];
    const row = bodyEffectsBody.createDiv("nr-row");
    row.createEl("span", { cls: "nr-row-label", text: meta.label });
    row.classList.toggle("nr-hidden", !params?.enabled);
    bodyEffectParamRows[name] = row;
    makeField(host, row, "强度", String(params?.opacity ?? meta.defaultOpacity),
      { min: meta.min, max: meta.max, step: 10, unit: "%" },
      (val) => {
        const eff = host.effective.bodyEffects ?? bodyEffects;
        const updated = { ...eff, [name]: { ...eff[name], opacity: val } };
        return host.updateSetting("bodyEffects", updated);
      });
    if (meta.defaultMode != null && meta.modeOptions?.length) {
      const modeSelect = row.createEl("select", { cls: "dropdown nr-dropdown-narrow nr-effect-mode-select" });
      for (const option of meta.modeOptions) {
        modeSelect.createEl("option", { value: option.value, text: option.label });
      }
      modeSelect.value = params?.mode ?? meta.defaultMode;
      modeSelect.title = `${meta.label}模式`;
      modeSelect.addEventListener("change", () => {
        if (host.syncing) return;
        const eff = host.effective.bodyEffects ?? bodyEffects;
        const updated = { ...eff, [name]: { ...eff[name], mode: modeSelect.value } };
        void host.updateSetting("bodyEffects", updated);
      });
    }
    if (meta.defaultShape != null && meta.shapeOptions?.length) {
      const shapeSelect = row.createEl("select", { cls: "dropdown nr-dropdown-narrow nr-effect-shape-select" });
      for (const option of meta.shapeOptions) {
        shapeSelect.createEl("option", { value: option.value, text: option.label });
      }
      shapeSelect.value = params?.shape ?? meta.defaultShape;
      shapeSelect.title = `${meta.label}形状`;
      shapeSelect.addEventListener("change", () => {
        if (host.syncing) return;
        const eff = host.effective.bodyEffects ?? bodyEffects;
        const updated = { ...eff, [name]: { ...eff[name], shape: shapeSelect.value } };
        void host.updateSetting("bodyEffects", updated);
      });
    }
    if (meta.defaultCount != null) {
      makeField(host, row, "数量", String(params?.count ?? meta.defaultCount),
        { min: meta.countMin!, max: meta.countMax! },
        (val) => {
          const eff = host.effective.bodyEffects ?? bodyEffects;
          const updated = { ...eff, [name]: { ...eff[name], count: val } };
          return host.updateSetting("bodyEffects", updated);
        });
    }
    if (meta.defaultWidth != null) {
      makeField(host, row, "宽", String(params?.width ?? meta.defaultWidth),
        { min: meta.widthMin!, max: meta.widthMax!, step: meta.widthStep ?? 1 },
        (val) => {
          const eff = host.effective.bodyEffects ?? bodyEffects;
          const updated = { ...eff, [name]: { ...eff[name], width: val } };
          return host.updateSetting("bodyEffects", updated);
        });
    }
    if (meta.defaultSpacing != null) {
      makeField(host, row, "间距", String(params?.spacing ?? meta.defaultSpacing),
        { min: meta.spacingMin!, max: meta.spacingMax!, step: meta.spacingStep ?? 1, unit: "px" },
        (val) => {
          const eff = host.effective.bodyEffects ?? bodyEffects;
          const updated = { ...eff, [name]: { ...eff[name], spacing: val } };
          return host.updateSetting("bodyEffects", updated);
        });
    }
    if (meta.defaultSize != null) {
      makeField(host, row, "点", String(params?.size ?? meta.defaultSize),
        { min: meta.sizeMin!, max: meta.sizeMax!, step: meta.sizeStep ?? 1, unit: "px" },
        (val) => {
          const eff = host.effective.bodyEffects ?? bodyEffects;
          const updated = { ...eff, [name]: { ...eff[name], size: val } };
          return host.updateSetting("bodyEffects", updated);
        });
    }
    bodyEffectChips[name]?.addEventListener("click", () => {
      row.classList.toggle("nr-hidden", !bodyEffectChips[name].classList.contains("active"));
    });
  }

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
        .onClick(() => { void host.handleExportCurrentPage(); });
    });
    menu.addItem((item) => {
      item.setTitle("导出全部 (zip)")
        .setIcon("archive")
        .onClick(() => { void host.handleExport(); });
    });
    menu.showAtMouseEvent(e);
  });

  // Navigation — 3-column layout
  const nav = contentEl.createDiv("nr-nav");

  // Left: note actions
  const navLeft = nav.createDiv("nr-nav-left");
  const saveToNoteBtn = navLeft.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-text nr-save-note-btn", text: "存入笔记" });
  saveToNoteBtn.title = "保存当前配置到笔记";
  saveToNoteBtn.addEventListener("click", () => { void host.handleSaveToNote(); });

  const removeFromNoteBtn = navLeft.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-text nr-remove-note-btn", text: "移除" });
  removeFromNoteBtn.title = "移除笔记中的渲染配置";
  removeFromNoteBtn.addEventListener("click", () => { void host.handleRemoveFromNote(); });

  // Center: pagination with single-page export
  const navCenter = nav.createDiv("nr-nav-center");
  const prevBtn = navCenter.createEl("button", { cls: "nr-nav-btn" });
  setIcon(prevBtn, "chevron-left");
  prevBtn.addEventListener("click", () => host.goPage(-1));

  const pageIndicator = navCenter.createDiv("nr-page-indicator");
  const nextBtn = navCenter.createEl("button", { cls: "nr-nav-btn" });
  setIcon(nextBtn, "chevron-right");
  nextBtn.addEventListener("click", () => host.goPage(1));

  // Right: export
  const navRight = nav.createDiv("nr-nav-right");

  const exportBtn = navRight.createEl("button", { cls: "nr-nav-btn" });
  exportBtn.title = "导出全部 zip";
  setIcon(exportBtn, "archive");
  exportBtn.addEventListener("click", () => { void host.handleExport(); });

  return {
    presetSelect,
    presetLockBtn,
    configSourceBadge,
    themeSelect,
    modeSelect,
    modeBtns: { long: modeBtn35, card: modeBtn34 },
    sizeInput,
    fontSelect,
    coverFontSelect,
    scaleInput,
    coverOpacityInput,
    coverMarkStyleBtns: {
      marker: markBtnMarker,
      block: markBtnBlock,
      underline: markBtnUnderline,
    },
    lsInput,
    lhInput,
    strokeStyleSelect,
    strokeInput,
    opInput,
    doubleStrokeInput,
    glowToggle,
    glowInput,
    strokeColorInput,
    doubleStrokeColorInput,
    strokeAlphaInput: opInput,
    glowColorInput,
    overlayToggle,
    oxInput,
    oyInput,
    coverPaddingInput,
    shadowToggle,
    blurInput,
    shadowColorInput,
    shadowAlphaInput,
    bannerToggle,
    strokeToggle,
    strokeParamsRow,
    doubleStrokeField,
    doubleStrokeColorField,
    glowParamsRow,
    bannerParamsRow,
    shadowParamsRow,
    alignBtns: alignBtns as { left: HTMLElement; center: HTMLElement; right: HTMLElement },
    coverEffectChips: coverEffectChipMap,
    coverEffectParamRows,
    bodyEffectChips,
    bodyEffectParamRows,
    coverColorInput: colorInput,
    saveToNoteBtn,
    removeFromNoteBtn,
    coverSection,
    bodySection,
    bodyEffectsSection: bodyEffectsWrap,
    listStyleBtns: { default: listBtnDefault, capsule: listBtnCapsule },
    previewContainer,
    pageDisplay,
    pageIndicator,
  };
}
