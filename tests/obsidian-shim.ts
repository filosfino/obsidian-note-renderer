export class App {}
export class Component {}
export class Plugin {}
export class Notice {}
export class TFile {}
export class TAbstractFile {}
export class WorkspaceLeaf {}
export class Modal {
  app: App;
  contentEl: HTMLElement;

  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement("div");
  }

  open() {}
  close() {}
}
export class ItemView {
  leaf: WorkspaceLeaf;
  contentEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.contentEl = document.createElement("div");
  }
}

export class Setting {
  settingEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.settingEl = container;
  }

  addText(cb: (text: { setValue(value: string): { onChange(fn: (value: string) => void): unknown } }) => unknown) {
    cb({
      setValue() {
        return {
          onChange() {
            return undefined;
          },
        };
      },
    });
    return this;
  }

  addButton(cb: (btn: {
    setButtonText(value: string): any;
    setCta(): any;
    onClick(fn: () => void): any;
  }) => unknown) {
    const button = {
      setButtonText() {
        return button;
      },
      setCta() {
        return button;
      },
      onClick() {
        return button;
      },
    };
    cb(button);
    return this;
  }
}

export class Menu {
  addItem(cb: (item: { setTitle(value: string): any; setIcon(value: string): any; onClick(fn: () => void): any }) => unknown) {
    const item = {
      setTitle() {
        return item;
      },
      setIcon() {
        return item;
      },
      onClick() {
        return item;
      },
    };
    cb(item);
    return this;
  }

  showAtMouseEvent() {}
}

export function normalizePath(value: string): string {
  return value;
}

export function setIcon() {}

export function debounce<T extends (...args: any[]) => unknown>(fn: T): T {
  return fn;
}

export function sanitizeHTMLToDom(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.cloneNode(true) as DocumentFragment;
}
