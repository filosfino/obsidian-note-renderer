import { describe, expect, it } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { PreviewView } from "../src/preview-view";
import { RENDER_DEFAULTS } from "../src/schema";
import { TFile } from "obsidian";

function createPluginStub(overrides?: Partial<typeof RENDER_DEFAULTS> & {
  activePreset?: string;
  presets?: Record<string, { values: Record<string, unknown>; locked: boolean }>;
  customFonts?: unknown[];
}) {
  const settings = {
    ...RENDER_DEFAULTS,
    activePreset: "",
    presets: {},
    customFonts: [],
    ...overrides,
  };

  return {
    getActivePresetName: () => settings.activePreset,
    getPresetValues: (name: string) => settings.presets[name]?.values as Record<string, unknown> | undefined,
    getPresetNames: () => Object.keys(settings.presets),
    getPresetDisplayName: (name: string) => name,
    isPresetLocked: (name: string) => settings.presets[name]?.locked ?? false,
    getFallbackRenderConfig: () => ({ ...RENDER_DEFAULTS, ...settings }),
    setFallbackRenderValue: (key: keyof typeof RENDER_DEFAULTS, value: unknown) => {
      (settings as Record<string, unknown>)[key] = value;
    },
    setActivePresetName: (name: string) => {
      settings.activePreset = name;
    },
    clearActivePreset: () => {
      settings.activePreset = "";
    },
    saveSettings: async () => {},
  };
}

describe("PreviewView preset state", () => {
  it("marks a preset as modified when the working config differs from it", () => {
    const plugin = createPluginStub({
      fontSize: 28,
      activePreset: "示例",
      presets: {
        示例: {
          values: {
            ...RENDER_DEFAULTS,
            fontSize: 28,
          },
          locked: false,
        },
      },
    });

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    const effective = {
      ...plugin.getFallbackRenderConfig(),
      fontSize: 30,
    };

    expect((view as unknown as { isPresetModified: (s: typeof effective) => boolean }).isPresetModified(effective)).toBe(true);
  });

  it("reports default source when settings match runtime defaults", () => {
    const plugin = createPluginStub();
    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    const effective = { ...RENDER_DEFAULTS };

    const source = (view as unknown as {
      getConfigSourceState: (s: typeof effective) => { label: string };
    }).getConfigSourceState(effective);

    expect(source.label).toBe("默认值");
  });

  it("reports preset working state when a preset is active", () => {
    const plugin = createPluginStub({
      activePreset: "示例",
      presets: {
        示例: {
          values: { ...RENDER_DEFAULTS, fontSize: 28 },
          locked: false,
        },
      },
    });

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    const source = (view as unknown as {
      getConfigSourceState: (s: typeof RENDER_DEFAULTS) => { label: string };
    }).getConfigSourceState({
      ...RENDER_DEFAULTS,
      fontSize: 30,
    });

    expect(source.label).toBe("预设工作态");
  });

  it("loads the selected preset into working config", async () => {
    const plugin = createPluginStub({
      presets: {
        示例: {
          values: {
            ...RENDER_DEFAULTS,
            fontSize: 30,
          },
          locked: false,
        },
      },
    });

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    await view.applyPreset("示例");

    expect(plugin.getActivePresetName()).toBe("示例");
    expect(plugin.getFallbackRenderConfig().fontSize).toBe(30);
  });

  it("clears stale modified labels from previously selected presets", () => {
    const plugin = {
      ...createPluginStub({
        activePreset: "B",
        presets: {
          A: {
            values: {
              ...RENDER_DEFAULTS,
              fontSize: 28,
            },
            locked: false,
          },
          B: {
            values: {
              ...RENDER_DEFAULTS,
              fontSize: 30,
            },
            locked: false,
          },
        },
      }),
      getPresetDisplayName: (name: string) => name,
      getPresetNames: () => ["A", "B"],
      isPresetLocked: () => false,
    };

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    const presetSelect = document.createElement("select");
    const optionA = document.createElement("option");
    optionA.value = "A";
    optionA.text = "A (modified)";
    const optionB = document.createElement("option");
    optionB.value = "B";
    optionB.text = "B";
    presetSelect.append(optionA, optionB);

    (view as unknown as {
      refs: {
        presetSelect: HTMLSelectElement;
        presetLockBtn: HTMLButtonElement;
      };
    }).refs = {
      presetSelect,
      presetLockBtn: document.createElement("button"),
    };

    (view as unknown as { syncPresetUi: (s: typeof RENDER_DEFAULTS) => void }).syncPresetUi({
      ...RENDER_DEFAULTS,
      fontSize: 30,
    });

    expect(optionA.text).toBe("A");
    expect(optionB.text).toBe("B");
  });

  it("resets working config to the default preset values", () => {
    const plugin = createPluginStub({
      fontSize: 30,
      activeTheme: "cream",
      activePreset: "示例",
      presets: {
        default: {
          values: {
            ...RENDER_DEFAULTS,
            activeTheme: "mist",
            fontSize: 28,
            pageMode: "card",
          },
          locked: false,
        },
      },
    });

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { resetWorkingConfigToDefault: () => void }).resetWorkingConfigToDefault();

    expect(plugin.getFallbackRenderConfig()).toMatchObject({
      activeTheme: "mist",
      fontSize: 28,
      pageMode: "card",
    });
  });

  it("resets to defaults and clears preset when switching notes", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "notes/next.md";
    file.extension = "md";

    const plugin = {
      ...createPluginStub({
        activeTheme: "mist",
        fontSize: 28,
        activePreset: "示例",
      }),
      app: {
        workspace: {
          getActiveFile: () => file,
        },
        vault: {
          read: async () => "# Note\n",
        },
      },
    };

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { app: unknown; currentFilePath: string | null }).app = plugin.app as never;
    (view as unknown as { currentFilePath: string | null }).currentFilePath = "notes/prev.md";

    const session = await (view as unknown as {
      buildNoteSession: (filePath: string, extension: string) => Promise<{
        shouldResetWorkingConfig: boolean;
        effectiveSettings: typeof RENDER_DEFAULTS;
      }>;
    }).buildNoteSession("notes/next.md", "md");

    expect(session.shouldResetWorkingConfig).toBe(true);
    expect(plugin.getActivePresetName()).toBe("");
    expect(session.effectiveSettings).toMatchObject({
      activeTheme: RENDER_DEFAULTS.activeTheme,
      fontSize: RENDER_DEFAULTS.fontSize,
    });
  });

  it("does not try to export the current page when no pages are rendered", async () => {
    const view = new PreviewView(new WorkspaceLeaf(), createPluginStub() as never);

    await expect(view.handleExportCurrentPage()).resolves.toBeUndefined();
  });

  it("does not try to export a zip when no pages are rendered", async () => {
    const view = new PreviewView(new WorkspaceLeaf(), createPluginStub() as never);

    await expect(view.handleExport()).resolves.toBeUndefined();
  });
});
