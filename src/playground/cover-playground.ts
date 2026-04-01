import { Component, TFile, WorkspaceLeaf } from "obsidian";
import { PreviewView } from "../preview-view";
import { RENDER_DEFAULTS, RENDER_KEYS, type RenderOptions } from "../schema";
import { THEME_PAPER } from "../themes/paper";
import { THEME_GRAPHITE } from "../themes/graphite";
import { THEME_INK_GOLD } from "../themes/ink-gold";
import { THEME_AMBER } from "../themes/amber";
import { THEME_CREAM } from "../themes/cream";
import { THEME_LATTE } from "../themes/latte";
import { THEME_SAGE } from "../themes/sage";
import { THEME_MIST } from "../themes/mist";
import { THEME_ROSE } from "../themes/rose";
import type { FontEntry } from "../fonts";

type RendererConfig = RenderOptions;
type RendererPreset = RendererConfig;

interface RendererPresetEntry {
  values: Partial<RendererPreset>;
  locked: boolean;
}

interface PluginUiState {
  activePreset: string;
  presets: Record<string, RendererPresetEntry>;
  customFonts: FontEntry[];
}

const STORAGE_KEY = "note-renderer-cover-playground-state";
const PLAYGROUND_FILE_PATH = "playground/cover-playground.md";
const DEFAULT_MARKDOWN = `# 封面 Playground

## 标题

用浏览器直接调试封面标题

## 封面文字

这是 cover playground。

你可以在左侧直接修改 markdown，
右侧用和 Obsidian 一样的 toolbar 调参数。

## 正文

这里只是占位，当前 playground 主要面向封面调试。
`;

const THEME_MAP = new Map<string, string>([
  ["paper", THEME_PAPER],
  ["graphite", THEME_GRAPHITE],
  ["ink-gold", THEME_INK_GOLD],
  ["amber", THEME_AMBER],
  ["cream", THEME_CREAM],
  ["latte", THEME_LATTE],
  ["sage", THEME_SAGE],
  ["mist", THEME_MIST],
  ["rose", THEME_ROSE],
]);

function createEventBus() {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  return {
    on(event: string, handler: (...args: any[]) => void) {
      let handlers = listeners.get(event);
      if (!handlers) {
        handlers = new Set();
        listeners.set(event, handlers);
      }
      handlers.add(handler);
    },
    off(event: string, handler: (...args: any[]) => void) {
      listeners.get(event)?.delete(handler);
    },
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.forEach((handler) => handler(...args));
    },
  };
}

class PlaygroundPlugin extends Component {
  app: any;
  private pluginState: PluginUiState;
  private fallbackRenderConfig: RendererConfig;

  constructor(app: any, initialState?: Partial<PluginUiState>, initialFallback?: Partial<RendererConfig>) {
    super();
    this.app = app;
    this.pluginState = {
      activePreset: initialState?.activePreset ?? "",
      presets: initialState?.presets ?? {},
      customFonts: initialState?.customFonts ?? [],
    };
    this.fallbackRenderConfig = {
      ...RENDER_DEFAULTS,
      ...initialFallback,
      coverEffects: {
        ...RENDER_DEFAULTS.coverEffects,
        ...(initialFallback?.coverEffects ?? {}),
      },
    };
  }

  getThemeNames(): string[] {
    return Array.from(THEME_MAP.keys());
  }

  async loadTheme(name: string): Promise<string> {
    return THEME_MAP.get(name) ?? THEME_MAP.get("mist") ?? "";
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

  savePreset(name: string, source?: Partial<RendererPreset>): boolean {
    const existing = this.pluginState.presets[name];
    if (existing?.locked) return false;
    const values: Partial<RendererPreset> = {};
    const mutable = values as Record<string, unknown>;
    for (const key of RENDER_KEYS) {
      mutable[key] = source?.[key] ?? this.fallbackRenderConfig[key];
    }
    this.pluginState.presets[name] = {
      values,
      locked: existing?.locked ?? false,
    };
    this.setActivePresetName(name);
    return true;
  }

  deletePreset(name: string): void {
    delete this.pluginState.presets[name];
    if (this.pluginState.activePreset === name) this.pluginState.activePreset = "";
  }

  async saveSettings(): Promise<void> {
    persistPlaygroundState({
      markdown: this.app.vault.__getMarkdown(),
      pluginState: this.pluginState,
      fallbackRenderConfig: this.fallbackRenderConfig,
    });
  }
}

function persistPlaygroundState(state: {
  markdown: string;
  pluginState: PluginUiState;
  fallbackRenderConfig: RendererConfig;
}): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadPlaygroundState(): {
  markdown: string;
  pluginState: PluginUiState;
  fallbackRenderConfig: RendererConfig;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      markdown?: string;
      pluginState?: PluginUiState;
      fallbackRenderConfig?: RendererConfig;
    };
    return {
      markdown: parsed.markdown ?? DEFAULT_MARKDOWN,
      pluginState: parsed.pluginState ?? { activePreset: "", presets: {}, customFonts: [] },
      fallbackRenderConfig: parsed.fallbackRenderConfig ?? { ...RENDER_DEFAULTS, coverEffects: { ...RENDER_DEFAULTS.coverEffects } },
    };
  } catch {
    return null;
  }
}

function patchDomHelpers(): void {
  const proto = HTMLElement.prototype as any;
  if (!proto.createEl) {
    proto.createEl = function createEl(tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string>; type?: string }) {
      const el = document.createElement(tag);
      if (options?.cls) el.className = options.cls;
      if (options?.text != null) el.textContent = options.text;
      if (options?.type) el.setAttribute("type", options.type);
      if (options?.attr) {
        for (const [key, value] of Object.entries(options.attr)) el.setAttribute(key, value);
      }
      this.appendChild(el);
      return el;
    };
  }
  if (!proto.createDiv) {
    proto.createDiv = function createDiv(arg?: string | { cls?: string; text?: string }) {
      const el = document.createElement("div");
      if (typeof arg === "string") el.className = arg;
      if (arg && typeof arg === "object") {
        if (arg.cls) el.className = arg.cls;
        if (arg.text != null) el.textContent = arg.text;
      }
      this.appendChild(el);
      return el;
    };
  }
  if (!proto.empty) {
    proto.empty = function empty() {
      this.replaceChildren();
    };
  }
  if (!proto.addClass) {
    proto.addClass = function addClass(...classes: string[]) {
      this.classList.add(...classes);
    };
  }
  if (!proto.removeClass) {
    proto.removeClass = function removeClass(...classes: string[]) {
      this.classList.remove(...classes);
    };
  }
  if (!proto.setCssStyles) {
    proto.setCssStyles = function setCssStyles(styles: Record<string, string | number>) {
      for (const [key, value] of Object.entries(styles)) {
        this.style[key as any] = String(value);
      }
    };
  }
}

function createFakeApp(markdownRef: { value: string }) {
  const workspaceBus = createEventBus();
  const vaultBus = createEventBus();
  const file = new TFile();
  file.path = PLAYGROUND_FILE_PATH;
  file.basename = "cover-playground";
  file.extension = "md";

  return {
    metadataCache: {
      getFirstLinkpathDest(name: string) {
        if (/^(https?:|data:|app:)/.test(name)) return { path: name };
        return null;
      },
    },
    workspace: {
      getActiveFile() {
        return file;
      },
      getLeavesOfType() {
        return [];
      },
      on(event: string, handler: (...args: any[]) => void) {
        workspaceBus.on(event, handler);
      },
      off(event: string, handler: (...args: any[]) => void) {
        workspaceBus.off(event, handler);
      },
      __emit(event: string, ...args: any[]) {
        workspaceBus.emit(event, ...args);
      },
    },
    vault: {
      read: async () => markdownRef.value,
      modify: async (_file: TFile, value: string) => {
        markdownRef.value = value;
        const textarea = document.getElementById("nr-playground-markdown") as HTMLTextAreaElement | null;
        if (textarea) textarea.value = value;
        vaultBus.emit("modify", file);
      },
      getResourcePath(fileLike: { path: string }) {
        return fileLike.path;
      },
      on(event: string, handler: (...args: any[]) => void) {
        vaultBus.on(event, handler);
      },
      off(event: string, handler: (...args: any[]) => void) {
        vaultBus.off(event, handler);
      },
      __getMarkdown() {
        return markdownRef.value;
      },
    },
  };
}

function mountLayout(): { editor: HTMLTextAreaElement; panelRoot: HTMLElement } {
  const app = document.getElementById("app");
  if (!app) throw new Error("Missing #app root");
  app.innerHTML = `
    <div class="nr-playground-shell">
      <section class="nr-playground-editor-pane">
        <div class="nr-playground-pane-head">
          <h2>Markdown</h2>
          <div class="nr-playground-actions">
            <button id="nr-playground-reset" class="nr-btn nr-btn-sm nr-btn-text">Reset</button>
          </div>
        </div>
        <textarea id="nr-playground-markdown" class="nr-playground-editor"></textarea>
      </section>
      <section class="nr-playground-panel-pane">
        <div class="nr-playground-pane-head">
          <h2>Toolbar / Preview</h2>
        </div>
        <div id="nr-playground-panel" class="nr-playground-panel"></div>
      </section>
    </div>
  `;
  return {
    editor: document.getElementById("nr-playground-markdown") as HTMLTextAreaElement,
    panelRoot: document.getElementById("nr-playground-panel") as HTMLElement,
  };
}

async function main(): Promise<void> {
  patchDomHelpers();
  const persisted = loadPlaygroundState();
  const markdownRef = { value: persisted?.markdown ?? DEFAULT_MARKDOWN };
  const fakeApp = createFakeApp(markdownRef);
  const plugin = new PlaygroundPlugin(fakeApp, persisted?.pluginState, persisted?.fallbackRenderConfig);
  const { editor, panelRoot } = mountLayout();
  editor.value = markdownRef.value;

  const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
  (view as any).app = fakeApp;
  view.contentEl = panelRoot;
  await view.onOpen();

  const persist = async () => {
    await plugin.saveSettings();
  };

  editor.addEventListener("input", () => {
    markdownRef.value = editor.value;
    window.clearTimeout((editor as any).__refreshTimer);
    (editor as any).__refreshTimer = window.setTimeout(() => {
      fakeApp.vault.__getMarkdown = () => markdownRef.value;
      void view.refresh();
      void persist();
    }, 120);
  });

  document.getElementById("nr-playground-reset")?.addEventListener("click", () => {
    markdownRef.value = DEFAULT_MARKDOWN;
    editor.value = DEFAULT_MARKDOWN;
    localStorage.removeItem(STORAGE_KEY);
    void view.refresh();
    void plugin.saveSettings();
  });

  window.addEventListener("beforeunload", () => {
    markdownRef.value = editor.value;
    persistPlaygroundState({
      markdown: markdownRef.value,
      pluginState: (plugin as any).pluginState,
      fallbackRenderConfig: plugin.getFallbackRenderConfig(),
    });
  });
}

void main();
