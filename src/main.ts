import { Plugin } from "obsidian";
import { VIEW_TYPE } from "./constants";
import { PreviewView } from "./preview-view";
import { TEMPLATE_DEFAULT } from "./templates/default";
import { TEMPLATE_DARK } from "./templates/dark";
import { TEMPLATE_DARK_GOLD } from "./templates/dark-gold";

interface NoteRendererSettings {
  activeTemplate: string;
}

const DEFAULT_SETTINGS: NoteRendererSettings = {
  activeTemplate: "dark",
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

  async indexTemplates(): Promise<void> {
    this.templateCache.clear();

    // Bundled templates
    this.templateCache.set("default", TEMPLATE_DEFAULT);
    this.templateCache.set("dark", TEMPLATE_DARK);
    this.templateCache.set("dark-gold", TEMPLATE_DARK_GOLD);

    // User templates from plugin directory
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

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
