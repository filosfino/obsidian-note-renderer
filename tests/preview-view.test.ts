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
    getFallbackRenderConfig: () => ({ ...RENDER_DEFAULTS, ...settings }),
    setFallbackRenderValue: (key: keyof typeof RENDER_DEFAULTS, value: unknown) => {
      (settings as Record<string, unknown>)[key] = value;
    },
    setActivePresetName: (name: string) => {
      settings.activePreset = name;
    },
    saveSettings: async () => {},
  };
}

describe("PreviewView preset state", () => {
  it("marks a preset as modified when the current note config differs from it", () => {
    const plugin = createPluginStub({
      fontSize: 42,
      activePreset: "示例",
      presets: {
        示例: {
          values: {
            ...RENDER_DEFAULTS,
            fontSize: 42,
          },
          locked: false,
        },
      },
    });

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    (view as unknown as { hasNoteConfig: boolean }).hasNoteConfig = true;
    const effective = {
      ...plugin.getFallbackRenderConfig(),
      fontSize: 88,
    };

    expect((view as unknown as { isPresetModified: (s: typeof effective) => boolean }).isPresetModified(effective)).toBe(true);
  });

  it("does not treat preset lock metadata changes as modified", () => {
    const plugin = createPluginStub({
      fontSize: 42,
      activePreset: "示例",
      presets: {
        示例: {
          values: {
            ...RENDER_DEFAULTS,
            fontSize: 42,
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

  it("falls back to global settings when the active note has no renderer_config yet", () => {
    const plugin = createPluginStub({
      fontSize: 42,
      activePreset: "示例",
      presets: {
        示例: {
          values: {
            ...RENDER_DEFAULTS,
            fontSize: 42,
          },
          locked: false,
        },
      },
    });

    const view = new PreviewView(new WorkspaceLeaf(), plugin as never);
    const effective = {
      ...plugin.getFallbackRenderConfig(),
      fontSize: 88,
    };

    expect((view as unknown as { isPresetModified: (s: typeof effective) => boolean }).isPresetModified(effective)).toBe(false);
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

    await view.updateNoteConfig("fontSize", 48);

    expect(markdown).toContain("renderer_config:");
    expect(markdown).toContain("fontSize: 48");
  });

  it("does not rewrite note config when applying a preset", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "test.md";
    file.extension = "md";
    let markdown = `# Note

## renderer_config

\`\`\`yaml
theme: cream
fontSize: 42
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
              fontSize: 48,
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
    expect(plugin.getFallbackRenderConfig().fontSize).toBe(48);
    expect(markdown).toContain("fontSize: 42");
  });

  it("does not insert renderer_config when applying a preset to a note without one", async () => {
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
              fontSize: 48,
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
    expect(plugin.getFallbackRenderConfig().fontSize).toBe(48);
    expect(markdown).not.toContain("renderer_config:");
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
      fontSize: 52,
      activeTheme: "mist",
    } as never;

    await view.handleSaveToNote();

    expect(markdown).toContain("renderer_config:");
    expect(markdown).toContain("fontSize: 52");
    expect(markdown).toContain("theme: mist");
  });

  it("resets working config to the default preset values", () => {
    const plugin = createPluginStub({
      fontSize: 60,
      activeTheme: "cream",
      activePreset: "示例",
      presets: {
        default: {
          values: {
            ...RENDER_DEFAULTS,
            activeTheme: "mist",
            fontSize: 40,
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
      fontSize: 40,
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
  fontSize: 48
---

# Note
`;

    const plugin = {
      ...createPluginStub({
        activeTheme: "mist",
        fontSize: 40,
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
        effectiveSettings: typeof RENDER_DEFAULTS;
      }>;
    }).buildNoteSession("notes/test.md", "md");

    expect(session.filePath).toBe("notes/test.md");
    expect(session.hasNoteConfig).toBe(true);
    expect(session.shouldResetWorkingConfig).toBe(false);
    expect(session.effectiveSettings).toMatchObject({
      activeTheme: "cream",
      fontSize: 48,
    });
  });

  it("marks switched notes without renderer_config for working-config reset", async () => {
    const file = new TFile() as TFile & { path: string; extension: string };
    file.path = "notes/next.md";
    file.extension = "md";

    const plugin = {
      ...createPluginStub({
        activeTheme: "mist",
        fontSize: 40,
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
      }>;
    }).buildNoteSession("notes/next.md", "md");

    expect(session.hasNoteConfig).toBe(false);
    expect(session.shouldResetWorkingConfig).toBe(true);
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
