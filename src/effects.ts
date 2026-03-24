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
  const colors = ctx.isDark
    ? ["rgba(120,80,220,0.8)", "rgba(40,160,180,0.7)", "rgba(200,80,120,0.5)"]
    : ["rgba(100,60,180,0.6)", "rgba(30,130,150,0.5)", "rgba(180,60,100,0.4)"];
  const el = createOverlay({ opacity: String(op), mixBlendMode: ctx.effectBlend, overflow: "hidden" });
  const blobs: { w: string; h: string; styles: Record<string, string>; color: string; blur: string }[] = [
    { w: "60%", h: "50%", styles: { top: "10%", left: "-10%" }, color: colors[0], blur: "80px" },
    { w: "50%", h: "40%", styles: { top: "50%", right: "-5%" }, color: colors[1], blur: "70px" },
    { w: "40%", h: "35%", styles: { bottom: "5%", left: "20%" }, color: colors[2], blur: "60px" },
  ];
  for (const b of blobs) {
    const div = document.createElement("div");
    div.setCssStyles({ position: "absolute", width: b.w, height: b.h, ...b.styles, background: `radial-gradient(circle,${b.color},transparent 70%)`, filter: `blur(${b.blur})` });
    el.appendChild(div);
  }
  container.appendChild(el);
}

function renderBokeh(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const el = createOverlay({ opacity: String(op) });
  const circles: string[] = [];
  const seed = [0.15, 0.73, 0.42, 0.88, 0.31, 0.67, 0.09, 0.56, 0.81, 0.24, 0.95, 0.38, 0.61, 0.77, 0.03, 0.49];
  for (let i = 0; i < 16; i++) {
    const x = Math.round(seed[i] * ctx.pageWidth);
    const y = Math.round(seed[(i + 5) % 16] * ctx.pageHeight);
    const size = 20 + Math.round(seed[(i + 3) % 16] * 60);
    const alpha = 0.3 + seed[(i + 7) % 16] * 0.5;
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
  const colors = ctx.isDark
    ? ["rgba(255,180,80,0.9)", "rgba(255,120,100,0.7)"]
    : ["rgba(200,140,50,0.7)", "rgba(200,80,60,0.5)"];
  const el = createOverlay({ opacity: String(op), mixBlendMode: ctx.effectBlend, overflow: "hidden" });
  const leaks: { w: string; h: string; styles: Record<string, string>; color: string; blur: string }[] = [
    { w: "50%", h: "50%", styles: { top: "-10%", right: "-10%" }, color: colors[0], blur: "60px" },
    { w: "40%", h: "40%", styles: { bottom: "-5%", left: "-5%" }, color: colors[1], blur: "50px" },
  ];
  for (const l of leaks) {
    const div = document.createElement("div");
    div.setCssStyles({ position: "absolute", width: l.w, height: l.h, ...l.styles, background: `radial-gradient(circle,${l.color},transparent 70%)`, filter: `blur(${l.blur})` });
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
  const cols = 10;
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
