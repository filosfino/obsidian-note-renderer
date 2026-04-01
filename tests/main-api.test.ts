import { beforeEach, describe, expect, it, vi } from "vitest";
import NoteRendererPlugin from "../src/main";
import { TFile } from "obsidian";
import { RENDER_DEFAULTS } from "../src/schema";
import type { RendererPresetEntry, PluginUiState } from "../src/main";

const {
  exportSinglePageMock,
  scaleBlobMock,
  renderNoteMock,
} = vi.hoisted(() => ({
  exportSinglePageMock: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
  scaleBlobMock: vi.fn(async (blob: Blob) => blob),
  renderNoteMock: vi.fn(),
}));

vi.mock("../src/exporter", () => ({
  exportSinglePage: exportSinglePageMock,
  scaleBlob: scaleBlobMock,
}));

vi.mock("../src/renderer", () => ({
  renderNote: renderNoteMock,
}));

function createMarkdownFile(path: string): TFile & { path: string; extension: string } {
  const file = new TFile() as TFile & { path: string; extension: string };
  file.path = path;
  file.extension = "md";
  return file;
}

function seedPluginState(
  plugin: NoteRendererPlugin,
  options?: {
    fallback?: Partial<typeof RENDER_DEFAULTS>;
    activePreset?: string;
    presets?: Record<string, RendererPresetEntry>;
    customFonts?: { label: string; value: string }[];
  },
): void {
  (plugin as unknown as {
    fallbackRenderConfig: typeof RENDER_DEFAULTS;
    pluginState: PluginUiState;
  }).fallbackRenderConfig = { ...RENDER_DEFAULTS, coverEffects: { ...RENDER_DEFAULTS.coverEffects } };
  (plugin as unknown as {
    fallbackRenderConfig: typeof RENDER_DEFAULTS;
    pluginState: PluginUiState;
  }).pluginState = {
    activePreset: "",
    presets: {},
    customFonts: [],
  };
  for (const [key, value] of Object.entries({ ...RENDER_DEFAULTS, ...(options?.fallback ?? {}) })) {
    plugin.setFallbackRenderValue(key as keyof typeof RENDER_DEFAULTS, value as never);
  }
  plugin.replacePluginState({
    activePreset: options?.activePreset ?? "",
    presets: options?.presets ?? {},
    customFonts: options?.customFonts ?? [],
  } satisfies PluginUiState);
}

beforeEach(() => {
  exportSinglePageMock.mockClear();
  scaleBlobMock.mockClear();
  renderNoteMock.mockReset();
});

describe("renderer_config script API", () => {
  it("loads grouped note config from a markdown note", async () => {
    const file = createMarkdownFile("test.md");
    const plugin = Object.create(NoteRendererPlugin.prototype) as NoteRendererPlugin & { app: any };
    plugin.app = {
      vault: {
        getAbstractFileByPath: () => file,
        read: async () => `
# Note

## renderer_config

\`\`\`yaml
theme: graphite
coverFontScale: 180
\`\`\`
`,
      },
    };

    const grouped = await plugin.loadRendererConfigFromNote("test.md");
    expect(grouped).toMatchObject({
      theme: "graphite",
      cover: {
        typography: {
          scale: 180,
        },
      },
      rendererConfigVersion: 1,
    });
  });

  it("writes grouped schema back when given legacy flat input", async () => {
    const file = createMarkdownFile("test.md");
    let markdown = `
# Note

## 正文

hello
`;

    const plugin = Object.create(NoteRendererPlugin.prototype) as NoteRendererPlugin & { app: any };
    plugin.app = {
      vault: {
        getAbstractFileByPath: () => file,
        read: async () => markdown,
        modify: async (_file: TFile, value: string) => {
          markdown = value;
        },
      },
    };

    const result = await plugin.writeRendererConfigToNote("test.md", {
      theme: "cream",
      coverFontScale: 160,
      coverOverlay: true,
      coverOverlayOpacity: 70,
    });

    expect(markdown).toContain("rendererConfigVersion: 1");
    expect(markdown).toContain("cover:");
    expect(markdown).toContain("scale: 160");
    expect(markdown).toContain("overlay:");
    expect(markdown).not.toContain("coverFontScale:");
    expect(result).toMatchObject({
      theme: "cream",
      cover: {
        typography: {
          scale: 160,
        },
        effects: {
          overlay: {
            enabled: true,
            opacity: 70,
          },
        },
      },
    });
  });
});

describe("headless render export API", () => {
  it("scales exported blobs in-process for renderToFiles instead of shelling out", async () => {
    const file = createMarkdownFile("notes/test.md") as TFile & { basename: string };
    file.basename = "test";
    const writeFileSync = vi.fn();
    const mkdirSync = vi.fn();
    renderNoteMock.mockResolvedValue({
      pages: [document.createElement("div"), document.createElement("div")],
      cleanup: vi.fn(),
      hasCoverImage: false,
    });

    const plugin = Object.create(NoteRendererPlugin.prototype) as NoteRendererPlugin & { app: any; loadTheme: (name: string) => Promise<string> };
    seedPluginState(plugin);
    plugin.loadTheme = async () => ".theme {}";
    plugin.app = {
      vault: {
        getAbstractFileByPath: () => file,
        read: async () => "# Test",
      },
    };

    const fsModule = require("fs") as { mkdirSync: typeof mkdirSync; writeFileSync: typeof writeFileSync };
    const originalMkdirSync = fsModule.mkdirSync;
    const originalWriteFileSync = fsModule.writeFileSync;
    fsModule.mkdirSync = mkdirSync;
    fsModule.writeFileSync = writeFileSync;

    try {
      const output = await plugin.renderToFiles("notes/test.md", "/tmp/out", 0.5);

      expect(output).toEqual(["/tmp/out/test_01.png", "/tmp/out/test_02.png"]);
      expect(exportSinglePageMock).toHaveBeenCalledTimes(2);
      expect(scaleBlobMock).toHaveBeenCalledTimes(2);
      expect(mkdirSync).toHaveBeenCalledWith("/tmp/out", { recursive: true });
      expect(writeFileSync).toHaveBeenCalledTimes(2);
    } finally {
      fsModule.mkdirSync = originalMkdirSync;
      fsModule.writeFileSync = originalWriteFileSync;
    }
  });

  it("skips blob scaling when scale is not a shrinking factor", async () => {
    const file = createMarkdownFile("notes/test.md") as TFile & { basename: string };
    file.basename = "test";
    const writeFileSync = vi.fn();
    const mkdirSync = vi.fn();
    renderNoteMock.mockResolvedValue({
      pages: [document.createElement("div")],
      cleanup: vi.fn(),
      hasCoverImage: false,
    });

    const plugin = Object.create(NoteRendererPlugin.prototype) as NoteRendererPlugin & { app: any; loadTheme: (name: string) => Promise<string> };
    seedPluginState(plugin);
    plugin.loadTheme = async () => ".theme {}";
    plugin.app = {
      vault: {
        getAbstractFileByPath: () => file,
        read: async () => "# Test",
      },
    };

    const fsModule = require("fs") as { mkdirSync: typeof mkdirSync; writeFileSync: typeof writeFileSync };
    const originalMkdirSync = fsModule.mkdirSync;
    const originalWriteFileSync = fsModule.writeFileSync;
    fsModule.mkdirSync = mkdirSync;
    fsModule.writeFileSync = writeFileSync;

    try {
      await plugin.renderPage("notes/test.md", 1, "/tmp/out", 1);

      expect(exportSinglePageMock).toHaveBeenCalledTimes(1);
      expect(scaleBlobMock).not.toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalledTimes(1);
    } finally {
      fsModule.mkdirSync = originalMkdirSync;
      fsModule.writeFileSync = originalWriteFileSync;
    }
  });
});

describe("preset locking", () => {
  it("stores presets with lock metadata and blocks overwriting locked presets", () => {
    const plugin = Object.create(NoteRendererPlugin.prototype) as NoteRendererPlugin;
    seedPluginState(plugin);

    expect(plugin.savePreset("基础预设")).toBe(true);
    expect(plugin.getPresetEntry("基础预设")).toMatchObject({
      locked: false,
    });

    plugin.togglePresetLock("基础预设");
    plugin.setFallbackRenderValue("fontSize", 88);

    expect(plugin.savePreset("基础预设")).toBe(false);
    expect(plugin.getPresetEntry("基础预设")?.values.fontSize).toBe(RENDER_DEFAULTS.fontSize);
  });

  it("formats locked preset names with a trailing lock emoji", () => {
    const plugin = Object.create(NoteRendererPlugin.prototype) as NoteRendererPlugin;
    seedPluginState(plugin, {
      presets: {
        示例: {
          values: { fontSize: 42 },
          locked: true,
        },
      },
    });

    expect(plugin.getPresetDisplayName("示例")).toBe("示例 🔒");
    expect(plugin.isPresetLocked("示例")).toBe(true);
  });

  it("persists only preset/font/ui metadata to data.json", async () => {
    const plugin = Object.create(NoteRendererPlugin.prototype) as NoteRendererPlugin & {
      saveData: (value: unknown) => Promise<void>;
    };
    let saved: any = null;
    seedPluginState(plugin, {
      activePreset: "示例",
      fallback: {
        fontSize: 88,
        activeTheme: "mist",
      },
      presets: {
        示例: {
          values: { fontSize: 42 },
          locked: true,
        },
      },
      customFonts: [{ label: "Test", value: "\"Test\", sans-serif" }],
    });
    plugin.saveData = async (value: unknown) => {
      saved = value;
    };

    await plugin.saveSettings();

    expect(saved).toEqual({
      activePreset: "示例",
      presets: {
        示例: {
          values: { fontSize: 42 },
          locked: true,
        },
      },
      customFonts: [{ label: "Test", value: "\"Test\", sans-serif" }],
    });
    expect(saved.fontSize).toBeUndefined();
    expect(saved.activeTheme).toBeUndefined();
  });

  it("keeps fallback render config and plugin ui state physically separated behind the settings compatibility layer", () => {
    const plugin = Object.create(NoteRendererPlugin.prototype) as NoteRendererPlugin;
    seedPluginState(plugin, {
      activePreset: "示例",
      fallback: {
        fontSize: 42,
      },
      presets: {
        示例: {
          values: { fontSize: 42 },
          locked: false,
        },
      },
      customFonts: [{ label: "Test", value: "\"Test\", sans-serif" }],
    });

    expect(plugin.getFallbackRenderConfig().fontSize).toBe(42);
    expect(plugin.getActivePresetName()).toBe("示例");
    expect(plugin.getCustomFonts()).toEqual([{ label: "Test", value: "\"Test\", sans-serif" }]);

    plugin.setFallbackRenderValue("fontSize", 88);

    expect(plugin.getFallbackRenderConfig().fontSize).toBe(88);
    expect(plugin.getActivePresetName()).toBe("示例");
    expect(plugin.getPresetEntry("示例")?.values.fontSize).toBe(42);
  });

  it("does not let activePreset override fallback render config when loading settings", async () => {
    const plugin = Object.create(NoteRendererPlugin.prototype) as NoteRendererPlugin & {
      loadData: () => Promise<unknown>;
      saveData: (value: unknown) => Promise<void>;
    };

    (plugin as unknown as { fallbackRenderConfig: typeof RENDER_DEFAULTS }).fallbackRenderConfig = {
      ...RENDER_DEFAULTS,
      coverEffects: { ...RENDER_DEFAULTS.coverEffects },
    };
    (plugin as unknown as { pluginState: PluginUiState }).pluginState = {
      activePreset: "",
      presets: {},
      customFonts: [],
    };

    plugin.loadData = async () => ({
      activePreset: "Daily Challenge",
      presets: {
        "Daily Challenge": {
          values: {
            activeTheme: "mist",
            fontSize: 40,
            pageMode: "card",
          },
          locked: false,
        },
      },
      customFonts: [],
    });
    plugin.saveData = async () => {};

    await plugin.loadSettings();

    expect(plugin.getActivePresetName()).toBe("Daily Challenge");
    expect(plugin.getFallbackRenderConfig()).toMatchObject({
      activeTheme: RENDER_DEFAULTS.activeTheme,
      fontSize: RENDER_DEFAULTS.fontSize,
      pageMode: RENDER_DEFAULTS.pageMode,
    });
  });

  it("clears a stale active preset name when loading settings", async () => {
    const plugin = Object.create(NoteRendererPlugin.prototype) as NoteRendererPlugin & {
      loadData: () => Promise<unknown>;
      saveData: (value: unknown) => Promise<void>;
    };

    (plugin as unknown as { fallbackRenderConfig: typeof RENDER_DEFAULTS }).fallbackRenderConfig = {
      ...RENDER_DEFAULTS,
      coverEffects: { ...RENDER_DEFAULTS.coverEffects },
    };
    (plugin as unknown as { pluginState: PluginUiState }).pluginState = {
      activePreset: "",
      presets: {},
      customFonts: [],
    };

    plugin.loadData = async () => ({
      activePreset: "Missing Preset",
      presets: {},
      customFonts: [],
    });
    plugin.saveData = async () => {};

    await plugin.loadSettings();

    expect(plugin.getActivePresetName()).toBe("");
    expect(plugin.getFallbackRenderConfig()).toMatchObject({
      activeTheme: RENDER_DEFAULTS.activeTheme,
      fontSize: RENDER_DEFAULTS.fontSize,
      pageMode: RENDER_DEFAULTS.pageMode,
    });
  });
});
