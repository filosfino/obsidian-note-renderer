import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  Notice,
  setIcon,
} from "obsidian";
import { VIEW_TYPE, PAGE_WIDTH, PAGE_HEIGHT } from "./constants";
import { renderNote, RenderedPages } from "./renderer";
import { exportPages } from "./exporter";
import type NoteRendererPlugin from "./main";

export class PreviewView extends ItemView {
  plugin: NoteRendererPlugin;
  private pages: HTMLElement[] = [];
  private currentPage = 0;
  private rendered: RenderedPages | null = null;

  // DOM refs
  private previewContainer: HTMLElement | null = null;
  private pageDisplay: HTMLElement | null = null;
  private pageIndicator: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: NoteRendererPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Note Renderer";
  }

  getIcon(): string {
    return "image";
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.classList.add("nr-view");

    // Toolbar
    const toolbar = contentEl.createDiv("nr-toolbar");

    const templateSelect = toolbar.createEl("select", { cls: "nr-template-select" });
    this.plugin.getTemplateNames().forEach((name) => {
      templateSelect.createEl("option", { text: name, value: name });
    });
    templateSelect.value = this.plugin.settings.activeTemplate;
    templateSelect.addEventListener("change", async () => {
      this.plugin.settings.activeTemplate = templateSelect.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    const renderBtn = toolbar.createEl("button", { cls: "nr-btn nr-btn-render" });
    setIcon(renderBtn, "refresh-cw");
    renderBtn.title = "Render";
    renderBtn.addEventListener("click", () => this.refresh());

    const exportBtn = toolbar.createEl("button", { cls: "nr-btn nr-btn-export" });
    setIcon(exportBtn, "download");
    exportBtn.title = "Export ZIP";
    exportBtn.addEventListener("click", () => this.handleExport());

    // Preview area — scaled to fit sidebar
    this.previewContainer = contentEl.createDiv("nr-preview-area");
    this.pageDisplay = this.previewContainer.createDiv("nr-page-display");

    // Navigation
    const nav = contentEl.createDiv("nr-nav");
    const prevBtn = nav.createEl("button", { cls: "nr-nav-btn" });
    setIcon(prevBtn, "chevron-left");
    prevBtn.addEventListener("click", () => this.goPage(-1));

    this.pageIndicator = nav.createDiv("nr-page-indicator");

    const nextBtn = nav.createEl("button", { cls: "nr-nav-btn" });
    setIcon(nextBtn, "chevron-right");
    nextBtn.addEventListener("click", () => this.goPage(1));

    // Initial render
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.rendered?.cleanup();
  }

  async refresh(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      this.showEmpty("Open a markdown file to preview");
      return;
    }

    const markdown = await this.app.vault.read(file);
    const templateCss = await this.plugin.loadTemplate(this.plugin.settings.activeTemplate);

    this.rendered?.cleanup();
    this.rendered = await renderNote(
      this.app,
      markdown,
      file.path,
      templateCss,
      this.plugin
    );

    this.pages = this.rendered.pages;
    this.currentPage = 0;
    this.showPage();
  }

  private showPage(): void {
    if (!this.pageDisplay || !this.pageIndicator) return;

    this.pageDisplay.empty();

    if (this.pages.length === 0) {
      this.showEmpty("No content to render");
      return;
    }

    const page = this.pages[this.currentPage];
    const wrapper = this.pageDisplay.createDiv("nr-page-wrapper");

    // Clone the page for display
    const clone = page.cloneNode(true) as HTMLElement;
    clone.style.transformOrigin = "top left";
    wrapper.appendChild(clone);

    // Scale to fit the sidebar
    requestAnimationFrame(() => {
      const availableWidth = this.pageDisplay!.clientWidth - 20;
      const scale = Math.min(availableWidth / PAGE_WIDTH, 0.4);
      clone.style.transform = `scale(${scale})`;
      wrapper.style.width = `${PAGE_WIDTH * scale}px`;
      wrapper.style.height = `${PAGE_HEIGHT * scale}px`;
    });

    this.pageIndicator.textContent = `${this.currentPage + 1} / ${this.pages.length}`;
  }

  private showEmpty(msg: string): void {
    if (!this.pageDisplay) return;
    this.pageDisplay.empty();
    this.pageDisplay.createDiv({ cls: "nr-empty", text: msg });
    if (this.pageIndicator) this.pageIndicator.textContent = "";
  }

  private goPage(delta: number): void {
    const next = this.currentPage + delta;
    if (next >= 0 && next < this.pages.length) {
      this.currentPage = next;
      this.showPage();
    }
  }

  private async handleExport(): Promise<void> {
    if (this.pages.length === 0) {
      new Notice("Nothing to export");
      return;
    }

    const file = this.app.workspace.getActiveFile();
    const name = file ? file.basename : "note";

    new Notice("Exporting...");
    try {
      const zipBlob = await exportPages(this.pages, name);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      new Notice(`Exported ${this.pages.length} pages`);
    } catch (e) {
      console.error("Export failed:", e);
      new Notice("Export failed — check console");
    }
  }
}
