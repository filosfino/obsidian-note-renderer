import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import { DEFAULT_FONTS, isChineseFont, getFontCategory, getFontDisplayName, deduplicateFontFamilies, type FontEntry, type FontCategory } from "./fonts";

/** Modal for text input (replaces window.prompt) */
export class InputModal extends Modal {
  private result: string;
  private onSubmit: (result: string | null) => void;
  private placeholder: string;
  private title: string;

  constructor(app: App, title: string, placeholder: string, onSubmit: (result: string | null) => void) {
    super(app);
    this.title = title;
    this.placeholder = placeholder;
    this.result = placeholder;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h4", { text: this.title });

    new Setting(contentEl)
      .addText((text) =>
        text.setValue(this.placeholder).onChange((value) => {
          this.result = value;
        })
      );

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("确定").setCta().onClick(() => {
          this.close();
          this.onSubmit(this.result);
        })
      )
      .addButton((btn) =>
        btn.setButtonText("取消").onClick(() => {
          this.close();
          this.onSubmit(null);
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** Modal for confirmation (replaces window.confirm) */
export class ConfirmModal extends Modal {
  private message: string;
  private onConfirm: (confirmed: boolean) => void;

  constructor(app: App, message: string, onConfirm: (confirmed: boolean) => void) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("确定").setCta().onClick(() => {
          this.close();
          this.onConfirm(true);
        })
      )
      .addButton((btn) =>
        btn.setButtonText("取消").onClick(() => {
          this.close();
          this.onConfirm(false);
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ── Font management modal ───────────────────────────────────────────────────

/**
 * Shows all system fonts as a checklist. Already-added custom fonts are pre-checked.
 * User checks/unchecks to add/remove. Default fonts are excluded from the list.
 */
export class FontManagerModal extends Modal {
  private customFonts: FontEntry[];
  private onSave: (fonts: FontEntry[]) => void;
  /** Tracks which family names are currently selected */
  private selected: Set<string>;

  constructor(app: App, customFonts: FontEntry[], onSave: (fonts: FontEntry[]) => void) {
    super(app);
    this.customFonts = customFonts;
    this.onSave = onSave;
    // Pre-select families that are already in customFonts
    this.selected = new Set(customFonts.map(f => f.label));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("nr-font-manager");
    contentEl.createEl("h4", { text: "自定义字体" });

    if (!window.queryLocalFonts) {
      contentEl.createEl("p", { text: "当前环境不支持系统字体检测", cls: "nr-font-empty" });
      return;
    }

    // Toolbar: filters + check/uncheck + search
    const toolbar = contentEl.createDiv("nr-font-toolbar");

    // Filter buttons (horizontal)
    const filterBar = toolbar.createDiv("nr-font-filter-bar");
    filterBar.addClass("nr-font-filter-bar");
    const filters: { label: string; value: FontCategory | "all" | "chinese" }[] = [
      { label: "全部", value: "all" },
      { label: "中文", value: "chinese" },
      { label: "简体", value: "chinese-sc" },
      { label: "繁体", value: "chinese-tc" },
      { label: "英文", value: "other" },
    ];
    let activeFilter: FontCategory | "all" | "chinese" = "all";
    const filterBtns: HTMLElement[] = [];
    for (const f of filters) {
      const btn = filterBar.createEl("button", { cls: "nr-btn nr-btn-sm", text: f.label });
      if (f.value === "all") btn.addClass("nr-btn-active");
      filterBtns.push(btn);
    }

    // Check all / Uncheck all (horizontal, same row as filters)
    const batchBar = toolbar.createDiv("nr-font-batch-bar");
    batchBar.addClass("nr-font-batch-bar");
    const checkAllBtn = batchBar.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-text", text: "全选" });
    const uncheckAllBtn = batchBar.createEl("button", { cls: "nr-btn nr-btn-sm nr-btn-text", text: "全不选" });

    toolbar.addClass("nr-font-toolbar");

    const searchInput = contentEl.createEl("input", {
      cls: "nr-font-search",
      attr: { type: "text", placeholder: "搜索字体..." },
    });

    const listEl = contentEl.createDiv("nr-font-picker-list");
    const statusEl = contentEl.createEl("p", { cls: "nr-font-status" });

    // Load system fonts
    void (async () => {
      try {
        const systemFonts = await window.queryLocalFonts!();
        const allFamilies = [...new Set(systemFonts.map(f => f.family))].sort();
        const deduplicated = deduplicateFontFamilies(allFamilies);

        // Exclude fonts already in the default list
        const defaultLabels = new Set(DEFAULT_FONTS.map(f => f.label));
        const defaultValues = new Set(DEFAULT_FONTS.map(f => f.value));
        const families = deduplicated.filter(f =>
          !defaultLabels.has(f) && !defaultValues.has(`"${f}", sans-serif`));

        const updateStatus = () => {
          statusEl.textContent = `已选 ${this.selected.size} 个`;
        };
        updateStatus();

        const renderRow = (family: string, container: HTMLElement) => {
          const row = container.createDiv("nr-font-picker-row");
          const cb = row.createEl("input", { attr: { type: "checkbox" } });
          cb.checked = this.selected.has(family);
          cb.addEventListener("change", () => {
            if (cb.checked) this.selected.add(family);
            else this.selected.delete(family);
            updateStatus();
          });
          const displayName = getFontDisplayName(family);
          const text = displayName !== family ? `${displayName}　字体Font ${family}` : `字体Font ${family}`;
          const label = row.createEl("span", { text });
          label.setCssStyles({ fontFamily: `"${family}", sans-serif` });
        };

        const matchesFilter = (family: string): boolean => {
          if (activeFilter === "all") return true;
          const cat = getFontCategory(family);
          if (activeFilter === "chinese") return cat !== "other";
          return cat === activeFilter;
        };

        // Track currently visible families for check/uncheck all
        let visibleFamilies: string[] = [];

        const renderFiltered = () => {
          listEl.empty();
          const q = searchInput.value.toLowerCase();
          const filtered = families.filter(f => {
            if (!matchesFilter(f)) return false;
            if (!q) return true;
            return f.toLowerCase().includes(q) || getFontDisplayName(f).toLowerCase().includes(q);
          });
          visibleFamilies = filtered;

          const chinese = filtered.filter(f => isChineseFont(f));
          const other = filtered.filter(f => !isChineseFont(f));

          if (chinese.length > 0) {
            listEl.createEl("div", { cls: "nr-font-group-label", text: `中文字体 (${chinese.length})` });
            for (const family of chinese) renderRow(family, listEl);
          }
          if (other.length > 0) {
            listEl.createEl("div", { cls: "nr-font-group-label", text: `其他字体 (${other.length})` });
            for (const family of other) renderRow(family, listEl);
          }
          if (chinese.length === 0 && other.length === 0) {
            listEl.createEl("p", { text: "没有匹配的字体", cls: "nr-font-empty" });
          }
        };

        // Wire up filter buttons
        for (let i = 0; i < filters.length; i++) {
          filterBtns[i].addEventListener("click", () => {
            activeFilter = filters[i].value;
            filterBtns.forEach(b => b.removeClass("nr-btn-active"));
            filterBtns[i].addClass("nr-btn-active");
            renderFiltered();
          });
        }

        // Check all / Uncheck all — applies to currently visible (filtered) fonts
        checkAllBtn.addEventListener("click", () => {
          for (const f of visibleFamilies) this.selected.add(f);
          updateStatus();
          renderFiltered();
        });
        uncheckAllBtn.addEventListener("click", () => {
          for (const f of visibleFamilies) this.selected.delete(f);
          updateStatus();
          renderFiltered();
        });

        searchInput.addEventListener("input", () => renderFiltered());
        renderFiltered();
      } catch {
        listEl.createEl("p", { text: "无法获取系统字体", cls: "nr-font-empty" });
      }
    })();

    // Save / Cancel
    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("保存").setCta().onClick(() => {
          // Build new customFonts from selected set
          const result: FontEntry[] = [...this.selected].map(family => ({
            label: family,
            value: `"${family}", sans-serif`,
          }));
          this.close();
          this.onSave(result);
        })
      )
      .addButton((btn) =>
        btn.setButtonText("取消").onClick(() => {
          this.close();
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}
