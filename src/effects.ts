/**
 * effects.ts — Cover overlay effect registry.
 *
 * Each effect is a pure function: (container, opacity, context) → void.
 * To add a new effect:
 * 1. Write a render function here
 * 2. Register it in EFFECT_RENDERERS
 * 3. Add default params to RENDER_DEFAULTS.coverEffects in schema.ts
 * 4. Add UI metadata to EFFECT_META in schema.ts
 */

import { PAGE_WIDTH } from "./constants";
import type { EffectParams } from "./schema";

// ── Context passed to every effect renderer ─────────────────────────────────

export interface EffectContext {
  pageWidth: number;
  pageHeight: number;
  isDark: boolean;
  /** Adaptive color prefix: "rgba(255,255,255," for dark, "rgba(0,0,0," for light */
  effectColor: string;
  /** Blend mode: "screen" for dark, "multiply" for light */
  effectBlend: string;
}

type EffectRenderer = (container: HTMLElement, params: EffectParams, ctx: EffectContext) => void;

// ── Shared helpers ──────────────────────────────────────────────────────────

function createOverlay(dynamicStyles: Record<string, string>): HTMLElement {
  const div = document.createElement("div");
  div.classList.add("nr-effect-overlay");
  div.setCssStyles(dynamicStyles);
  return div;
}

// ── Effect renderers ────────────────────────────────────────────────────────

function renderGrain(container: HTMLElement, params: EffectParams): void {
  const op = params.opacity / 100;
  const id = `nr-grain-${Date.now()}`;
  const el = createOverlay({ opacity: String(op), mixBlendMode: "overlay" });
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  const filter = document.createElementNS(NS, "filter");
  filter.setAttribute("id", id);
  const turb = document.createElementNS(NS, "feTurbulence");
  turb.setAttribute("type", "fractalNoise");
  turb.setAttribute("baseFrequency", "0.65");
  turb.setAttribute("numOctaves", "3");
  turb.setAttribute("stitchTiles", "stitch");
  filter.appendChild(turb);
  svg.appendChild(filter);
  const rect = document.createElementNS(NS, "rect");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("filter", `url(#${id})`);
  svg.appendChild(rect);
  el.appendChild(svg);
  container.appendChild(el);
}

function renderAurora(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const count = params.count ?? 3;
  const darkPalette = [
    { color: "rgba(120,80,220,0.8)", blur: 80 },
    { color: "rgba(40,160,180,0.7)", blur: 70 },
    { color: "rgba(200,80,120,0.5)", blur: 60 },
    { color: "rgba(80,200,140,0.6)", blur: 75 },
    { color: "rgba(180,120,220,0.6)", blur: 65 },
    { color: "rgba(60,140,200,0.7)", blur: 70 },
  ];
  const lightPalette = [
    { color: "rgba(100,60,180,0.6)", blur: 80 },
    { color: "rgba(30,130,150,0.5)", blur: 70 },
    { color: "rgba(180,60,100,0.4)", blur: 60 },
    { color: "rgba(60,160,100,0.5)", blur: 75 },
    { color: "rgba(140,80,180,0.5)", blur: 65 },
    { color: "rgba(40,110,160,0.5)", blur: 70 },
  ];
  const palette = ctx.isDark ? darkPalette : lightPalette;
  const el = createOverlay({ opacity: String(op), mixBlendMode: ctx.effectBlend, overflow: "hidden" });

  // Deterministic positioning seeds
  const positions = [
    { w: 60, h: 50, top: 10, left: -10 },
    { w: 50, h: 40, top: 50, right: -5 },
    { w: 40, h: 35, bottom: 5, left: 20 },
    { w: 55, h: 45, top: 30, right: 10 },
    { w: 45, h: 38, bottom: 15, left: -5 },
    { w: 50, h: 42, top: 5, left: 35 },
  ];

  for (let i = 0; i < count; i++) {
    const p = palette[i % palette.length];
    const pos = positions[i % positions.length];
    const styles: Record<string, string> = {
      position: "absolute",
      width: `${pos.w}%`,
      height: `${pos.h}%`,
      background: `radial-gradient(circle,${p.color},transparent 70%)`,
      filter: `blur(${p.blur}px)`,
    };
    if ("top" in pos) styles.top = `${pos.top}%`;
    if ("bottom" in pos) styles.bottom = `${pos.bottom}%`;
    if ("left" in pos) styles.left = `${pos.left}%`;
    if ("right" in pos) styles.right = `${pos.right}%`;
    const div = document.createElement("div");
    div.setCssStyles(styles);
    el.appendChild(div);
  }
  container.appendChild(el);
}

function renderBokeh(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const count = params.count ?? 16;
  const el = createOverlay({ opacity: String(op) });
  const circles: string[] = [];
  // Extend seed array to support up to 40 circles
  const baseSeed = [0.15, 0.73, 0.42, 0.88, 0.31, 0.67, 0.09, 0.56, 0.81, 0.24, 0.95, 0.38, 0.61, 0.77, 0.03, 0.49];
  const seed = (i: number) => baseSeed[i % baseSeed.length];
  for (let i = 0; i < count; i++) {
    const x = Math.round(seed(i) * ctx.pageWidth);
    const y = Math.round(seed(i + 5) * ctx.pageHeight);
    const size = 20 + Math.round(seed(i + 3) * 60);
    const alpha = 0.3 + seed(i + 7) * 0.5;
    circles.push(`${x}px ${y}px 0 ${size}px ${ctx.effectColor}${alpha.toFixed(2)})`);
  }
  const dot = document.createElement("div");
  dot.setCssStyles({ position: "absolute", width: "1px", height: "1px", top: "0", left: "0", borderRadius: "50%", boxShadow: circles.join(",") });
  el.appendChild(dot);
  container.appendChild(el);
}

function renderGrid(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const lineColor = ctx.effectColor + "0.3)";
  const el = createOverlay({ opacity: String(op), backgroundImage: `repeating-linear-gradient(0deg,${lineColor} 0px,${lineColor} 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,${lineColor} 0px,${lineColor} 1px,transparent 1px,transparent 60px)` });
  container.appendChild(el);
}

function renderVignette(container: HTMLElement, params: EffectParams): void {
  const op = params.opacity / 100;
  const el = createOverlay({ background: `radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,${op}) 100%)` });
  container.appendChild(el);
}

function renderLightLeak(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const count = params.count ?? 2;
  const darkPalette = [
    { color: "rgba(255,180,80,0.9)", blur: 60 },
    { color: "rgba(255,120,100,0.7)", blur: 50 },
    { color: "rgba(255,200,120,0.6)", blur: 55 },
    { color: "rgba(255,150,60,0.8)", blur: 65 },
    { color: "rgba(240,100,80,0.6)", blur: 45 },
  ];
  const lightPalette = [
    { color: "rgba(200,140,50,0.7)", blur: 60 },
    { color: "rgba(200,80,60,0.5)", blur: 50 },
    { color: "rgba(200,160,80,0.5)", blur: 55 },
    { color: "rgba(180,120,40,0.6)", blur: 65 },
    { color: "rgba(190,70,50,0.4)", blur: 45 },
  ];
  const palette = ctx.isDark ? darkPalette : lightPalette;
  const positions = [
    { w: 50, h: 50, top: -10, right: -10 },
    { w: 40, h: 40, bottom: -5, left: -5 },
    { w: 45, h: 45, top: 20, left: -8 },
    { w: 35, h: 35, bottom: 15, right: -8 },
    { w: 42, h: 42, top: -5, left: 30 },
  ];
  const el = createOverlay({ opacity: String(op), mixBlendMode: ctx.effectBlend, overflow: "hidden" });
  for (let i = 0; i < count; i++) {
    const p = palette[i % palette.length];
    const pos = positions[i % positions.length];
    const styles: Record<string, string> = {
      position: "absolute",
      width: `${pos.w}%`,
      height: `${pos.h}%`,
      background: `radial-gradient(circle,${p.color},transparent 70%)`,
      filter: `blur(${p.blur}px)`,
    };
    if ("top" in pos) styles.top = `${pos.top}%`;
    if ("bottom" in pos) styles.bottom = `${pos.bottom}%`;
    if ("left" in pos) styles.left = `${pos.left}%`;
    if ("right" in pos) styles.right = `${pos.right}%`;
    const div = document.createElement("div");
    div.setCssStyles(styles);
    el.appendChild(div);
  }
  container.appendChild(el);
}

function renderScanlines(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const scanColor = ctx.effectColor + "0.5)";
  const el = createOverlay({ opacity: String(op), background: `repeating-linear-gradient(to bottom,transparent 0px,transparent 2px,${scanColor} 2px,${scanColor} 4px)` });
  container.appendChild(el);
}

function renderNetwork(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const cols = params.count ?? 10;
  const rows = Math.round(cols * ctx.pageHeight / ctx.pageWidth);
  const cellW = ctx.pageWidth / cols;
  const cellH = ctx.pageHeight / rows;
  const threshold = Math.max(cellW, cellH) * 1.6;

  let seed = 42;
  const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };

  const nodes: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cellW + (rand() - 0.5) * cellW * 0.8;
      const y = (r + 0.5) * cellH + (rand() - 0.5) * cellH * 0.8;
      nodes.push({ x, y });
    }
  }

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", String(ctx.pageWidth));
  svg.setAttribute("height", String(ctx.pageHeight));

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < threshold) {
        const lineOp = Math.pow(1 - d / threshold, 1.5).toFixed(2);
        const line = document.createElementNS(NS, "line");
        line.setAttribute("x1", String(nodes[i].x));
        line.setAttribute("y1", String(nodes[i].y));
        line.setAttribute("x2", String(nodes[j].x));
        line.setAttribute("y2", String(nodes[j].y));
        line.setAttribute("stroke", "currentColor");
        line.setAttribute("stroke-width", "1");
        line.setAttribute("opacity", lineOp);
        svg.appendChild(line);
      }
    }
  }
  for (const n of nodes) {
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("cx", String(n.x));
    circle.setAttribute("cy", String(n.y));
    circle.setAttribute("r", String(2 + rand() * 2));
    circle.setAttribute("fill", "currentColor");
    circle.setAttribute("opacity", (0.4 + rand() * 0.3).toFixed(2));
    svg.appendChild(circle);
  }

  const netColor = ctx.isDark ? "rgba(200,200,200,1)" : "rgba(80,80,80,1)";
  const el = createOverlay({ opacity: String(op), color: netColor });
  el.appendChild(svg);
  container.appendChild(el);
}

// ── Registry ────────────────────────────────────────────────────────────────

const EFFECT_RENDERERS: Record<string, EffectRenderer> = {
  // "overlay" is handled separately (gradient on cover content, not a div overlay)
  grain: renderGrain,
  aurora: renderAurora,
  bokeh: renderBokeh,
  grid: renderGrid,
  vignette: renderVignette,
  lightLeak: renderLightLeak,
  scanlines: renderScanlines,
  network: renderNetwork,
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Detect theme brightness from CSS background color.
 */
/** Extract the cover title color from theme CSS (`.nr-cover-content h1 { color: ... }`). */
export function extractCoverTitleColor(themeCss: string): string {
  const m = themeCss.match(/\.nr-cover-content\s+h1\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/);
  return m?.[1] ?? "";
}

export function extractPageBackgroundColor(themeCss: string): string {
  const m = themeCss.match(/\.nr-page\s*\{[^}]*background:\s*(#[0-9a-fA-F]{3,6})/);
  return m?.[1] ?? "";
}

export function extractBodyTextColor(themeCss: string): string {
  const m = themeCss.match(/\.nr-page\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/);
  return m?.[1] ?? "";
}

export interface CoverStrokePalette {
  fill: string;
  inner: string;
  outer: string;
  background: string;
}

export interface ThemeColorChoice {
  label: string;
  value: string;
}

export function deriveCoverStrokePalette(themeCss: string): CoverStrokePalette {
  const isDark = detectThemeBrightness(themeCss);
  const fill = extractCoverTitleColor(themeCss) || (isDark ? "#ffffff" : "#1a1a1a");
  const background = extractPageBackgroundColor(themeCss) || (isDark ? "#303030" : "#f4efe6");
  return {
    fill,
    background,
    inner: mixHex(fill, background, 0.18),
    outer: mixHex(fill, background, 0.72),
  };
}

export function extractThemeColorChoices(themeCss: string): ThemeColorChoice[] {
  const entries: ThemeColorChoice[] = [];
  const push = (label: string, value: string) => {
    if (!value) return;
    if (entries.some((entry) => entry.label === label && entry.value.toLowerCase() === value.toLowerCase())) return;
    entries.push({ label, value });
  };

  const pick = (pattern: RegExp): string => themeCss.match(pattern)?.[1] ?? "";
  const pickRgba = (pattern: RegExp): string => {
    const match = themeCss.match(pattern)?.[1] ?? "";
    return match ? `rgba(${match})` : "";
  };

  push("背景", extractPageBackgroundColor(themeCss));
  push("正文", extractBodyTextColor(themeCss));
  push("标题", extractCoverTitleColor(themeCss));
  push("高亮", pickRgba(/\.nr-cover-content\s+mark\s*\{[^}]*rgba?\(([^)]+)\)/));
  push("引用", pick(/\.nr-page-content\s+blockquote\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/));
  push("引用线", pick(/\.nr-page-content\s+blockquote\s*\{[^}]*border-left:\s*\d+px\s+solid\s+(#[0-9a-fA-F]{3,6})/));
  push("行内代码", pick(/\.nr-page-content\s+code\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/));
  push("代码底", pick(/\.nr-page-content\s+code\s*\{[^}]*background:\s*(#[0-9a-fA-F]{3,6})/));
  push("代码块底", pick(/\.nr-page-content\s+pre\s*\{[^}]*background:\s*(#[0-9a-fA-F]{3,6})/));
  push("正文强调", pick(/\.nr-page-content\s+strong\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,6})/));
  push("图片封面字", pick(/\.nr-cover-has-image\s+\.nr-cover-content\s+h1,[\s\S]*?color:\s*(#[0-9a-fA-F]{3,6})/));

  return entries;
}

export function detectThemeBrightness(themeCss: string): boolean {
  const bgMatch = themeCss.match(/\.nr-page\s*\{[^}]*background:\s*#([0-9a-fA-F]{3,6})/);
  if (!bgMatch) return true; // default assume dark
  const hex = bgMatch[1].length === 3
    ? bgMatch[1].split("").map(c => c + c).join("")
    : bgMatch[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

function normalizeHex(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length === 3) {
    return raw.split("").map((c) => c + c).join("");
  }
  return raw;
}

function mixHex(a: string, b: string, ratio: number): string {
  const aa = normalizeHex(a);
  const bb = normalizeHex(b);
  const r = Math.round(parseInt(aa.slice(0, 2), 16) * (1 - ratio) + parseInt(bb.slice(0, 2), 16) * ratio);
  const g = Math.round(parseInt(aa.slice(2, 4), 16) * (1 - ratio) + parseInt(bb.slice(2, 4), 16) * ratio);
  const bl = Math.round(parseInt(aa.slice(4, 6), 16) * (1 - ratio) + parseInt(bb.slice(4, 6), 16) * ratio);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Apply all enabled cover effects to a page element.
 * Iterates the registry — no hardcoded if-blocks needed.
 */
export function applyCoverEffects(
  container: HTMLElement,
  effects: Record<string, EffectParams>,
  themeCss: string,
  pageHeight: number,
): void {
  container.setCssStyles({ position: "relative", overflow: "hidden" });

  const isDark = detectThemeBrightness(themeCss);
  const ctx: EffectContext = {
    pageWidth: PAGE_WIDTH,
    pageHeight,
    isDark,
    effectColor: isDark ? "rgba(255,255,255," : "rgba(0,0,0,",
    effectBlend: isDark ? "screen" : "multiply",
  };

  for (const [name, renderer] of Object.entries(EFFECT_RENDERERS)) {
    const params = effects[name];
    if (params?.enabled) {
      renderer(container, params, ctx);
    }
  }
}
