import { Plugin } from "obsidian";
import { VIEW_TYPE } from "./constants";
import { PreviewView } from "./preview-view";

interface NoteRendererSettings {
  activeTemplate: string;
}

const DEFAULT_SETTINGS: NoteRendererSettings = {
  activeTemplate: "default",
};

export default class NoteRendererPlugin extends Plugin {
  settings: NoteRendererSettings = DEFAULT_SETTINGS;

  // Template cache: name → CSS string
  private templateCache: Map<string, string> = new Map();

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.indexTemplates();

    this.registerView(VIEW_TYPE, (leaf) => new PreviewView(leaf, this));

    this.addCommand({
      id: "open-preview",
      name: "Open preview",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "render-current",
      name: "Render current note",
      callback: async () => {
        await this.activateView();
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
        if (view instanceof PreviewView) {
          await view.refresh();
        }
      },
    });

    this.addRibbonIcon("image", "Note Renderer", () => this.activateView());
  }

  onunload(): void {
    this.templateCache.clear();
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  /**
   * Scan for template CSS files in the plugin's templates directory.
   * Templates are stored at: <vault>/.obsidian/plugins/note-renderer/templates/*.css
   */
  async indexTemplates(): Promise<void> {
    this.templateCache.clear();

    // Load bundled default template
    const defaultCss = this.getDefaultTemplate();
    this.templateCache.set("default", defaultCss);

    // Scan for user templates in the plugin directory
    const adapter = this.app.vault.adapter;
    const templatesDir = `${this.manifest.dir}/templates`;

    if (await adapter.exists(templatesDir)) {
      const listing = await adapter.list(templatesDir);
      for (const filePath of listing.files) {
        if (filePath.endsWith(".css")) {
          const name = filePath.split("/").pop()!.replace(".css", "");
          const css = await adapter.read(filePath);
          this.templateCache.set(name, css);
        }
      }
    }
  }

  getTemplateNames(): string[] {
    return Array.from(this.templateCache.keys());
  }

  async loadTemplate(name: string): Promise<string> {
    if (!this.templateCache.has(name)) {
      await this.indexTemplates();
    }
    return this.templateCache.get(name) ?? this.templateCache.get("default") ?? "";
  }

  private getDefaultTemplate(): string {
    return `
.nr-page {
  background: #fff;
  color: #1a1a1a;
  font-family: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 32px;
  line-height: 1.8;
}

.nr-title-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  text-align: center;
}

.nr-title-content h1 {
  font-size: 64px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0;
}

.nr-title-content h2,
.nr-title-content p {
  font-size: 36px;
  font-weight: 400;
  color: #666;
  margin: 16px 0 0 0;
}

.nr-page-content h1 { font-size: 52px; font-weight: 700; margin: 0 0 24px 0; }
.nr-page-content h2 { font-size: 44px; font-weight: 600; margin: 32px 0 16px 0; }
.nr-page-content h3 { font-size: 38px; font-weight: 600; margin: 24px 0 12px 0; }

.nr-page-content p {
  margin: 0 0 20px 0;
}

.nr-page-content blockquote {
  border-left: 6px solid #e0e0e0;
  padding: 8px 0 8px 24px;
  margin: 16px 0;
  color: #555;
  font-style: italic;
}

.nr-page-content ul,
.nr-page-content ol {
  padding-left: 40px;
  margin: 0 0 20px 0;
}

.nr-page-content li {
  margin-bottom: 8px;
}

.nr-page-content code {
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.9em;
}

.nr-page-content pre {
  background: #f5f5f5;
  padding: 24px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.nr-page-content img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 16px auto;
}

.nr-page-content strong {
  font-weight: 700;
}

.nr-page-content em {
  font-style: italic;
}

.nr-oversized {
  display: flex;
  align-items: center;
  justify-content: center;
}

.nr-oversized img {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
}
`;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
