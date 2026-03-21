import { Plugin } from "obsidian";
import { VIEW_TYPE } from "./constants";
import { PreviewView } from "./preview-view";
import { TEMPLATE_PAPER } from "./templates/paper";
import { TEMPLATE_GRAPHITE } from "./templates/graphite";
import { TEMPLATE_INK_GOLD } from "./templates/ink-gold";
import { TEMPLATE_AMBER } from "./templates/amber";
import { TEMPLATE_CREAM } from "./templates/cream";
import { TEMPLATE_LATTE } from "./templates/latte";
import { TEMPLATE_SAGE } from "./templates/sage";
import { TEMPLATE_MIST } from "./templates/mist";
import { TEMPLATE_ROSE } from "./templates/rose";

import type { PageMode, CoverStrokeStyle } from "./constants";

export interface NoteRendererSettings {
  activeTemplate: string;
  fontSize: number;
  fontFamily: string;
  coverFontFamily: string;
  coverStrokePercent: number;
  coverStrokeStyle: CoverStrokeStyle;
  coverStrokeOpacity: number;   // stroke alpha 0-100 (90 = rgba 0.9)
  coverGlowSize: number;        // glow multiplier 0-200 (60 = 0.6x stroke width)
  coverBanner: boolean;         // independent banner toggle
  coverBannerColor: string;     // banner mode background color
  coverBannerSkew: number;      // parallelogram skew percentage (0 = rectangle, 15 = steep)
  coverFontColor: string;       // empty = use theme default
  coverFontScale: number;       // font size multiplier (100 = auto, 150 = 1.5x)
  coverLetterSpacing: number;   // in 0.01em units (e.g. 5 = 0.05em)
  coverLineHeight: number;      // in 0.1 units (e.g. 13 = 1.3)
  coverOffsetX: number;         // cover text X offset in % of page width (-50 to 50)
  coverOffsetY: number;         // cover text Y offset in % of page height (-50 to 50)
  coverOverlay: boolean;        // gradient overlay on cover image
  coverShadow: boolean;
  coverShadowBlur: number;
  coverShadowOffsetX: number;
  coverShadowOffsetY: number;
  pageMode: PageMode;
}

const DEFAULT_SETTINGS: NoteRendererSettings = {
  activeTemplate: "cream",
  fontSize: 42,
  fontFamily: '"PingFang SC", "Noto Sans SC", sans-serif',
  coverFontFamily: '"Yuanti SC", "PingFang SC", sans-serif',
  coverStrokePercent: 20,
  coverStrokeStyle: "stroke",
  coverStrokeOpacity: 90,
  coverGlowSize: 60,
  coverBanner: false,
  coverBannerColor: "rgba(0,0,0,0.5)",
  coverBannerSkew: 6,
  coverFontColor: "",
  coverFontScale: 100,
  coverLetterSpacing: 5,
  coverLineHeight: 13,
  coverOffsetX: 0,
  coverOffsetY: 0,
  coverOverlay: true,
  coverShadow: true,
  coverShadowBlur: 16,
  coverShadowOffsetX: 0,
  coverShadowOffsetY: 4,
  pageMode: "long",
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
    this.templateCache.set("paper", TEMPLATE_PAPER);
    this.templateCache.set("graphite", TEMPLATE_GRAPHITE);
    this.templateCache.set("ink-gold", TEMPLATE_INK_GOLD);
    this.templateCache.set("amber", TEMPLATE_AMBER);
    this.templateCache.set("cream", TEMPLATE_CREAM);
    this.templateCache.set("latte", TEMPLATE_LATTE);
    this.templateCache.set("sage", TEMPLATE_SAGE);
    this.templateCache.set("mist", TEMPLATE_MIST);
    this.templateCache.set("rose", TEMPLATE_ROSE);

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
    return this.templateCache.get(name) ?? this.templateCache.get("cream") ?? "";
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
