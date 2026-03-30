Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0),
  writable: true,
});

Object.defineProperty(document, "fonts", {
  value: { ready: Promise.resolve() },
  configurable: true,
});

Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get() {
    const explicit = Number.parseFloat(this.getAttribute("data-test-height") || "");
    if (Number.isFinite(explicit)) return explicit;
    return this.children.length > 0 ? 80 : 24;
  },
});

if (!HTMLElement.prototype.setCssStyles) {
  HTMLElement.prototype.setCssStyles = function setCssStyles(styles: Record<string, string | number>) {
    for (const [key, value] of Object.entries(styles)) {
      // Map kebab-less style names used by Obsidian helper onto CSSStyleDeclaration.
      (this.style as unknown as Record<string, string>)[key] = String(value);
    }
  };
}

if (!HTMLElement.prototype.createEl) {
  HTMLElement.prototype.createEl = function createEl(tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }) {
    const el = document.createElement(tag);
    if (options?.cls) el.className = options.cls;
    if (options?.text != null) el.textContent = options.text;
    if (options?.attr) {
      for (const [key, value] of Object.entries(options.attr)) el.setAttribute(key, value);
    }
    this.appendChild(el);
    return el;
  };
}

if (!HTMLElement.prototype.createDiv) {
  HTMLElement.prototype.createDiv = function createDiv(cls?: string) {
    const el = document.createElement("div");
    if (cls) el.className = cls;
    this.appendChild(el);
    return el;
  };
}

if (!HTMLElement.prototype.empty) {
  HTMLElement.prototype.empty = function empty() {
    this.replaceChildren();
  };
}

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value() {
    const height = this.offsetHeight || 24;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: height,
      width: 0,
      height,
      toJSON() {
        return {};
      },
    };
  },
});

Object.defineProperty(HTMLImageElement.prototype, "complete", {
  configurable: true,
  get() {
    return true;
  },
});
