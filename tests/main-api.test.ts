import { describe, expect, it } from "vitest";
import NoteRendererPlugin from "../src/main";
import { TFile } from "obsidian";

function createMarkdownFile(path: string): TFile & { path: string; extension: string } {
  const file = new TFile() as TFile & { path: string; extension: string };
  file.path = path;
  file.extension = "md";
  return file;
}

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
