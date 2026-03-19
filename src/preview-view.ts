import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  TAbstractFile,
  Notice,
  setIcon,
  debounce,
} from "obsidian";
import { VIEW_TYPE, PAGE_WIDTH, PAGE_HEIGHT } from "./constants";
import { renderNote, RenderedPages, RenderOptions } from "./renderer";
import { exportPages } from "./exporter";
import type NoteRendererPlugin from "./main";

export class PreviewView extends ItemView {
  plugin: NoteRendererPlugin;
  private pages: HTMLElement[] = [];
  private currentPage = 0;
  private rendered: RenderedPages | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private fileChangeHandler: ((file: TAbstractFile) => void) | null = null;
  private activeFileHandler: (() => void) | null = null;

  // DOM refs
  private previewContainer: HTMLElement | null = null;
  private pageDisplay: HTMLElement | null = null;
  private pageIndicator: HTMLElement | null = null;

  // Current displayed clone + wrapper (for rescaling without re-rendering)
  private currentClone: HTMLElement | null = null;
  private currentWrapper: HTMLElement | null = null;

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

    // Font controls row
    const fontBar = contentEl.createDiv("nr-font-bar");

    // Font size: - [value] +
    const sizeDown = fontBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "−" });
    const sizeLabel = fontBar.createDiv({ cls: "nr-font-size-label", text: `${this.plugin.settings.fontSize}px` });
    const sizeUp = fontBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: "+" });

    sizeDown.addEventListener("click", async () => {
      this.plugin.settings.fontSize = Math.max(24, this.plugin.settings.fontSize - 2);
      sizeLabel.textContent = `${this.plugin.settings.fontSize}px`;
      await this.plugin.saveSettings();
      await this.refresh();
    });
    sizeUp.addEventListener("click", async () => {
      this.plugin.settings.fontSize = Math.min(72, this.plugin.settings.fontSize + 2);
      sizeLabel.textContent = `${this.plugin.settings.fontSize}px`;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Font family select
    const fontSelect = fontBar.createEl("select", { cls: "nr-font-select" });
    const fonts = [
      { label: "苹方", value: '"PingFang SC", "Noto Sans SC", sans-serif' },
      { label: "思源黑体", value: '"Noto Sans SC", "PingFang SC", sans-serif' },
      { label: "思源宋体", value: '"Noto Serif SC", "Songti SC", serif' },
      { label: "楷体", value: '"Kaiti SC", "STKaiti", serif' },
      { label: "系统默认", value: '-apple-system, "PingFang SC", sans-serif' },
    ];
    fonts.forEach((f) => {
      fontSelect.createEl("option", { text: f.label, value: f.value });
    });
    fontSelect.value = this.plugin.settings.fontFamily;
    fontSelect.addEventListener("change", async () => {
      this.plugin.settings.fontFamily = fontSelect.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Preview area
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

    // ResizeObserver — rescale on sidebar width change
    this.resizeObserver = new ResizeObserver(() => {
      this.rescale();
    });
    this.resizeObserver.observe(this.previewContainer);

    // Watch for file changes — auto-refresh when the current note is modified
    const debouncedRefresh = debounce(() => this.refresh(), 500, true);

    this.fileChangeHandler = (file: TAbstractFile) => {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && file.path === activeFile.path) {
        debouncedRefresh();
      }
    };
    this.app.vault.on("modify", this.fileChangeHandler);

    // Watch for active file change — refresh when switching notes
    this.activeFileHandler = () => {
      debouncedRefresh();
    };
    this.app.workspace.on("active-leaf-change", this.activeFileHandler as any);

    // Initial render
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.rendered?.cleanup();
    this.resizeObserver?.disconnect();
    if (this.fileChangeHandler) {
      this.app.vault.off("modify", this.fileChangeHandler);
    }
    if (this.activeFileHandler) {
      this.app.workspace.off("active-leaf-change", this.activeFileHandler as any);
    }
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
      this.plugin,
      {
        fontSize: this.plugin.settings.fontSize,
        fontFamily: this.plugin.settings.fontFamily,
      }
    );

    this.pages = this.rendered.pages;
    // Preserve current page if possible, otherwise reset to 0
    if (this.currentPage >= this.pages.length) {
      this.currentPage = 0;
    }
    this.showPage();
  }

  private showPage(): void {
    if (!this.pageDisplay || !this.pageIndicator) return;

    this.pageDisplay.empty();
    this.currentClone = null;
    this.currentWrapper = null;

    if (this.pages.length === 0) {
      this.showEmpty("No content to render");
      return;
    }

    const page = this.pages[this.currentPage];
    this.currentWrapper = this.pageDisplay.createDiv("nr-page-wrapper");

    this.currentClone = page.cloneNode(true) as HTMLElement;
    this.currentClone.style.transformOrigin = "top left";
    this.currentWrapper.appendChild(this.currentClone);

    this.rescale();

    this.pageIndicator.textContent = `${this.currentPage + 1} / ${this.pages.length}`;
  }

  /** Rescale the current page clone to fit the container width */
  private rescale(): void {
    if (!this.currentClone || !this.currentWrapper || !this.previewContainer) return;

    const areaWidth = this.previewContainer.clientWidth;
    const scale = (areaWidth - 24) / PAGE_WIDTH;
    this.currentClone.style.transform = `scale(${scale})`;
    this.currentWrapper.style.width = `${PAGE_WIDTH * scale}px`;
    this.currentWrapper.style.height = `${PAGE_HEIGHT * scale}px`;
  }

  private showEmpty(msg: string): void {
    if (!this.pageDisplay) return;
    this.pageDisplay.empty();
    this.currentClone = null;
    this.currentWrapper = null;
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
