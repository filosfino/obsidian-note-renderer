type EventHandler = (...args: any[]) => void;

class SimpleEventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set<EventHandler>();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((handler) => handler(...args));
  }
}

const noticeRootId = "nr-playground-notices";

function ensureNoticeRoot(): HTMLElement {
  let root = document.getElementById(noticeRootId);
  if (!root) {
    root = document.createElement("div");
    root.id = noticeRootId;
    root.className = "nr-playground-notices";
    document.body.appendChild(root);
  }
  return root;
}

export class App {}
export class Component {}
export class Plugin {}

export class Notice {
  constructor(message?: string) {
    if (!message) return;
    const root = ensureNoticeRoot();
    const el = document.createElement("div");
    el.className = "nr-playground-notice";
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }
}

export class TFile {
  path = "";
  extension = "md";
  basename = "playground";
}

export class TAbstractFile {
  path = "";
}

export class WorkspaceLeaf {}

export class Modal {
  app: App;
  contentEl: HTMLElement;
  private modalEl: HTMLElement | null = null;

  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement("div");
    this.contentEl.className = "modal-content";
  }

  onOpen() {}
  onClose() {}

  open() {
    const overlay = document.createElement("div");
    overlay.className = "modal";
    overlay.appendChild(this.contentEl);
    document.body.appendChild(overlay);
    this.modalEl = overlay;
    this.onOpen();
  }

  close() {
    this.onClose();
    this.modalEl?.remove();
    this.modalEl = null;
  }
}

export class ItemView {
  leaf: WorkspaceLeaf;
  contentEl: HTMLElement;
  app: any;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.contentEl = document.createElement("div");
  }
}

export class Setting {
  settingEl: HTMLElement;
  private controlEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.settingEl = document.createElement("div");
    this.settingEl.className = "setting-item";
    this.controlEl = document.createElement("div");
    this.controlEl.className = "setting-item-control";
    this.settingEl.appendChild(this.controlEl);
    container.appendChild(this.settingEl);
  }

  addText(cb: (text: { setValue(value: string): { onChange(fn: (value: string) => void): unknown } }) => unknown) {
    const input = document.createElement("input");
    input.type = "text";
    this.controlEl.appendChild(input);
    cb({
      setValue(value: string) {
        input.value = value;
        return {
          onChange(fn: (value: string) => void) {
            input.addEventListener("input", () => fn(input.value));
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
    const button = document.createElement("button");
    this.controlEl.appendChild(button);
    const api = {
      setButtonText(value: string) {
        button.textContent = value;
        return api;
      },
      setCta() {
        button.classList.add("mod-cta");
        return api;
      },
      onClick(fn: () => void) {
        button.addEventListener("click", fn);
        return api;
      },
    };
    cb(api);
    return this;
  }
}

export class Menu {
  private items: { title: string; onClick: (() => void) | null }[] = [];

  addItem(cb: (item: { setTitle(value: string): any; setIcon(value: string): any; onClick(fn: () => void): any }) => unknown) {
    const current = { title: "", onClick: null as (() => void) | null };
    const api = {
      setTitle(value: string) {
        current.title = value;
        return api;
      },
      setIcon(_value: string) {
        return api;
      },
      onClick(fn: () => void) {
        current.onClick = fn;
        return api;
      },
    };
    cb(api);
    this.items.push(current);
    return this;
  }

  showAtMouseEvent(event: MouseEvent) {
    const menu = document.createElement("div");
    menu.className = "menu";
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    const cleanup = () => {
      menu.remove();
      document.removeEventListener("mousedown", onPointer, true);
    };
    const onPointer = (pointerEvent: MouseEvent) => {
      if (!menu.contains(pointerEvent.target as Node)) cleanup();
    };

    for (const item of this.items) {
      const button = document.createElement("button");
      button.className = "menu-item";
      button.textContent = item.title;
      button.addEventListener("click", () => {
        cleanup();
        item.onClick?.();
      });
      menu.appendChild(button);
    }

    document.body.appendChild(menu);
    requestAnimationFrame(() => document.addEventListener("mousedown", onPointer, true));
  }
}

export function normalizePath(value: string): string {
  return value;
}

export function setIcon(el: HTMLElement, icon: string) {
  const iconMarkup: Record<string, string> = {
    "chevron-left": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    "chevron-right": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    archive: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="4" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M6 9.5h12v8.5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M10 13h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
    download: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="m8.5 11 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 18.5h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
    image: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
        <path d="m7 16 3.2-3.2a1 1 0 0 1 1.4 0L14 15l1.6-1.6a1 1 0 0 1 1.4 0L19 15.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    "align-left": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 7.5h12M5 11.5h8M5 15.5h12M5 19.5h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
    "align-center": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 7.5h12M8 11.5h8M6 15.5h12M8 19.5h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
    "align-right": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7.5h12M11 11.5h8M7 15.5h12M11 19.5h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
  };
  const markup = iconMarkup[icon];
  el.replaceChildren();
  if (!markup) {
    el.textContent = icon;
    return;
  }
  const wrapper = document.createElement("span");
  wrapper.className = "svg-icon";
  wrapper.innerHTML = markup.trim();
  el.appendChild(wrapper);
}

export function debounce<T extends (...args: any[]) => unknown>(fn: T, wait = 0): T {
  let timeout: number | null = null;
  return ((...args: any[]) => {
    if (timeout != null) window.clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      timeout = null;
      fn(...args);
    }, wait);
  }) as T;
}

export function sanitizeHTMLToDom(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.cloneNode(true) as DocumentFragment;
}

export function createEventBus() {
  return new SimpleEventBus();
}
