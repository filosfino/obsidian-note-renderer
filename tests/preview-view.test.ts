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
  it("marks a preset as modified when the current note config differs from it", () => {
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
    (view as unknown as { hasNoteConfig: boolean }).hasNoteConfig = true;
    const effective = {
      ...plugin.getFallbackRenderConfig(),
      fontSize: 30,
    };

    expect((view as unknown as { isPresetModified: (s: typeof effective) => boolean }).isPresetModified(effective)).toBe(true);
  });

  it("does not treat preset lock metadata changes as modified", () => {
    const plugin = createPluginStub({
      fontSize: 28,
      activePreset: "示例",
      presets: {
        示例: {
          values: {
            ...RENDER_DEFAULTS,
            fontSize: 28,
          },
          locked: true,
        },
      },
    });

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    expect((view as unknown as { isPresetModified: (s: ReturnType<typeof plugin.getFallbackRenderConfig>) => boolean }).isPresetModified(plugin.getFallbackRenderConfig())).toBe(false);
  });

  it("treats missing preset keys as defaults when checking modified state", () => {
    const plugin = createPluginStub({
      listStyle: "default",
      activePreset: "Daily Challenge",
      presets: {
        "Daily Challenge": {
          values: {
            ...RENDER_DEFAULTS,
            listStyle: undefined,
          },
          locked: false,
        },
      },
    });

    delete (plugin.getPresetValues("Daily Challenge") as Record<string, unknown>).listStyle;

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    expect((view as unknown as { isPresetModified: (s: ReturnType<typeof plugin.getFallbackRenderConfig>) => boolean }).isPresetModified(plugin.getFallbackRenderConfig())).toBe(false);
  });

  it("treats note defaults as modified when an active preset differs from them", () => {
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

  it("reports note config as the source when working state matches the loaded note", () => {
    const plugin = createPluginStub();
    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    const effective = { ...RENDER_DEFAULTS };

    (view as unknown as { hasNoteConfig: boolean }).hasNoteConfig = true;
    (view as unknown as { baselineSettings: typeof effective }).baselineSettings = { ...effective };

    const source = (view as unknown as {
      getConfigSourceState: (s: typeof effective) => { label: string };
    }).getConfigSourceState(effective);

    expect(source.label).toBe("笔记配置");
  });

  it("reports preset working state when UI differs from baseline under an active preset", () => {
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
    const baseline = { ...RENDER_DEFAULTS, fontSize: 28 };
    const working = { ...RENDER_DEFAULTS, fontSize: 30 };

    (view as unknown as { hasNoteConfig: boolean }).hasNoteConfig = true;
    (view as unknown as { baselineSettings: typeof baseline }).baselineSettings = baseline;

    const source = (view as unknown as {
      getConfigSourceState: (s: typeof working) => { label: string };
    }).getConfigSourceState(working);

    expect(source.label).toBe("预设工作态");
  });

  it("creates note renderer_config on first note-scoped setting change", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "test.md";
    file.extension = "md";
    let markdown = "# Note\n";

    const plugin = {
      ...createPluginStub(),
      app: {
        workspace: {
          getActiveFile: () => file,
        },
        vault: {
          read: async () => markdown,
          modify: async (_file: TFile, value: string) => {
            markdown = value;
          },
        },
      },
    };

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { app: unknown }).app = plugin.app as never;
    view.effective = plugin.getFallbackRenderConfig() as never;

    await view.updateNoteConfig("fontSize", 30);

    expect(markdown).toContain("renderer_config:");
    expect(markdown).toContain("fontSize: 30");
  });

  it("loads the selected preset into working config without rewriting note config", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "test.md";
    file.extension = "md";
    let markdown = `# Note

## renderer_config

\`\`\`yaml
theme: cream
fontSize: 28
\`\`\`

## 正文

hello
`;
    const plugin = {
      ...createPluginStub({
        presets: {
          示例: {
            values: {
              ...RENDER_DEFAULTS,
              fontSize: 30,
            },
            locked: false,
          },
        },
      }),
      app: {
        workspace: {
          getActiveFile: () => file,
        },
        vault: {
          read: async () => markdown,
          modify: async (_file: TFile, value: string) => {
            markdown = value;
          },
        },
      },
    };

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { app: unknown }).app = plugin.app as never;
    view.effective = {
      ...RENDER_DEFAULTS,
      activeTheme: "cream",
      fontSize: 28,
    } as never;

    await view.applyPreset("示例");

    expect(plugin.getActivePresetName()).toBe("示例");
    expect(plugin.getFallbackRenderConfig().fontSize).toBe(30);
    expect(markdown).toContain("## renderer_config");
    expect(markdown).toContain("fontSize: 28");
    expect(markdown).not.toContain("activePreset: 示例");
    expect(markdown).not.toContain("fontSize: 30");
  });

  it("does not create renderer_config when applying a preset to a note without one", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "test.md";
    file.extension = "md";
    let markdown = "# Note\n\n## 正文\n\nhello\n";

    const plugin = {
      ...createPluginStub({
        presets: {
          示例: {
            values: {
              ...RENDER_DEFAULTS,
              fontSize: 30,
            },
            locked: false,
          },
        },
      }),
      app: {
        workspace: {
          getActiveFile: () => file,
        },
        vault: {
          read: async () => markdown,
          modify: async (_file: TFile, value: string) => {
            markdown = value;
          },
        },
      },
    };

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { app: unknown }).app = plugin.app as never;

    await view.applyPreset("示例");

    expect(plugin.getActivePresetName()).toBe("示例");
    expect(plugin.getFallbackRenderConfig().fontSize).toBe(30);
    expect(markdown).not.toContain("renderer_config:");
    expect(markdown).not.toContain("activePreset: 示例");
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

  it("saves the current effective settings to note when handleSaveToNote is called", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "test.md";
    file.extension = "md";
    let markdown = "# Note\n";

    const plugin = {
      ...createPluginStub(),
      app: {
        workspace: {
          getActiveFile: () => file,
        },
        vault: {
          read: async () => markdown,
          modify: async (_file: TFile, value: string) => {
            markdown = value;
          },
        },
      },
    };

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { app: unknown }).app = plugin.app as never;
    view.effective = {
      ...plugin.getFallbackRenderConfig(),
      fontSize: 30,
      activeTheme: "mist",
    } as never;

    await view.handleSaveToNote();

    expect(markdown).toContain("renderer_config:");
    expect(markdown).toContain("fontSize: 30");
    expect(markdown).toContain("theme: mist");
  });

  it("saves only presetName when effective settings still match the selected preset", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "test.md";
    file.extension = "md";
    let markdown = "# Note\n";

    const plugin = {
      ...createPluginStub({
        activePreset: "示例",
        presets: {
          示例: {
            values: {
              ...RENDER_DEFAULTS,
              activeTheme: "mist",
              fontSize: 28,
            },
            locked: false,
          },
        },
      }),
      app: {
        workspace: {
          getActiveFile: () => file,
        },
        vault: {
          read: async () => markdown,
          modify: async (_file: TFile, value: string) => {
            markdown = value;
          },
        },
      },
    };

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { app: unknown }).app = plugin.app as never;
    view.effective = {
      ...RENDER_DEFAULTS,
      activeTheme: "mist",
      fontSize: 28,
    } as never;

    await view.handleSaveToNote();

    expect(markdown).toContain("renderer_config:");
    expect(markdown).toContain("presetName: 示例");
    expect(markdown).not.toContain("fontSize:");
    expect(markdown).not.toContain("theme:");
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

  it("builds a note session that reflects note-local renderer_config state", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "notes/test.md";
    file.extension = "md";
    const markdown = `---
renderer_config:
  theme: cream
  fontSize: 30
  presetName: Daily Challenge
---

# Note
`;

    const plugin = {
      ...createPluginStub({
        activeTheme: "mist",
        fontSize: 28,
        presets: {
          "Daily Challenge": {
            values: {
              ...RENDER_DEFAULTS,
              activeTheme: "cream",
              fontSize: 30,
            },
            locked: false,
          },
        },
      }),
      app: {
        workspace: {
          getActiveFile: () => file,
        },
        vault: {
          read: async () => markdown,
        },
      },
    };

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { app: unknown }).app = plugin.app as never;

    const session = await (view as unknown as {
      buildNoteSession: (filePath: string, extension: string) => Promise<{
        filePath: string;
        hasNoteConfig: boolean;
        shouldResetWorkingConfig: boolean;
        editingNoteConfig: boolean;
        effectiveSettings: typeof RENDER_DEFAULTS;
      }>;
    }).buildNoteSession("notes/test.md", "md");

    expect(session.filePath).toBe("notes/test.md");
    expect(session.hasNoteConfig).toBe(true);
    expect(session.shouldResetWorkingConfig).toBe(true);
    expect(session.editingNoteConfig).toBe(false);
    expect(plugin.getActivePresetName()).toBe("Daily Challenge");
    expect(session.effectiveSettings).toMatchObject({
      activeTheme: "cream",
      fontSize: 30,
    });
  });

  it("builds a note session from presetName-only frontmatter", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "notes/test.md";
    file.extension = "md";
    const markdown = `---
renderer_config:
  presetName: Daily Challenge
---

# Note
`;

    const plugin = {
      ...createPluginStub({
        activeTheme: "mist",
        fontSize: 28,
        presets: {
          "Daily Challenge": {
            values: {
              ...RENDER_DEFAULTS,
              activeTheme: "paper",
              fontSize: 30,
            },
            locked: false,
          },
        },
      }),
      app: {
        workspace: {
          getActiveFile: () => file,
        },
        vault: {
          read: async () => markdown,
        },
      },
    };

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { app: unknown }).app = plugin.app as never;

    const session = await (view as unknown as {
      buildNoteSession: (filePath: string, extension: string) => Promise<{
        hasNoteConfig: boolean;
        effectiveSettings: typeof RENDER_DEFAULTS;
      }>;
    }).buildNoteSession("notes/test.md", "md");

    expect(session.hasNoteConfig).toBe(true);
    expect(plugin.getActivePresetName()).toBe("Daily Challenge");
    expect(session.effectiveSettings).toMatchObject({
      activeTheme: "paper",
      fontSize: 30,
    });
  });

  it("re-applies presetName-only note config on same-file refresh", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "notes/test.md";
    file.extension = "md";
    const markdown = `---
renderer_config:
  presetName: Daily Challenge
---

# Note
`;

    const plugin = {
      ...createPluginStub({
        activeTheme: "mist",
        fontSize: 28,
        presets: {
          "Daily Challenge": {
            values: {
              ...RENDER_DEFAULTS,
              activeTheme: "paper",
              fontSize: 30,
            },
            locked: false,
          },
        },
      }),
      app: {
        workspace: {
          getActiveFile: () => file,
        },
        vault: {
          read: async () => markdown,
        },
      },
    };

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { app: unknown; currentFilePath: string | null }).app = plugin.app as never;
    (view as unknown as { currentFilePath: string | null }).currentFilePath = "notes/test.md";

    const session = await (view as unknown as {
      buildNoteSession: (filePath: string, extension: string) => Promise<{
        hasNoteConfig: boolean;
        shouldResetWorkingConfig: boolean;
        effectiveSettings: typeof RENDER_DEFAULTS;
      }>;
    }).buildNoteSession("notes/test.md", "md");

    expect(session.hasNoteConfig).toBe(true);
    expect(session.shouldResetWorkingConfig).toBe(true);
    expect(session.effectiveSettings).toMatchObject({
      activeTheme: "paper",
      fontSize: 30,
    });
  });

  it("falls back to render defaults and clears activePreset when a switched note has no renderer_config", async () => {
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
    (view as unknown as { app: unknown; currentFilePath: string | null }).currentFilePath = "notes/prev.md";

    const session = await (view as unknown as {
      buildNoteSession: (filePath: string, extension: string) => Promise<{
        hasNoteConfig: boolean;
        shouldResetWorkingConfig: boolean;
        effectiveSettings: typeof RENDER_DEFAULTS;
      }>;
    }).buildNoteSession("notes/next.md", "md");

    expect(session.hasNoteConfig).toBe(false);
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
