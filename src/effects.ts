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
  el.innerHTML = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#${id})"/></svg>`;
  container.appendChild(el);
}

function renderAurora(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const colors = ctx.isDark
    ? ["rgba(120,80,220,0.8)", "rgba(40,160,180,0.7)", "rgba(200,80,120,0.5)"]
    : ["rgba(100,60,180,0.6)", "rgba(30,130,150,0.5)", "rgba(180,60,100,0.4)"];
  const el = createOverlay({ opacity: String(op), mixBlendMode: ctx.effectBlend, overflow: "hidden" });
  el.innerHTML = `
    <div style="position:absolute;width:60%;height:50%;top:10%;left:-10%;background:radial-gradient(circle,${colors[0]},transparent 70%);filter:blur(80px);"></div>
    <div style="position:absolute;width:50%;height:40%;top:50%;right:-5%;background:radial-gradient(circle,${colors[1]},transparent 70%);filter:blur(70px);"></div>
    <div style="position:absolute;width:40%;height:35%;bottom:5%;left:20%;background:radial-gradient(circle,${colors[2]},transparent 70%);filter:blur(60px);"></div>
  `;
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
  el.innerHTML = `<div style="position:absolute;width:1px;height:1px;top:0;left:0;border-radius:50%;box-shadow:${circles.join(",")};"></div>`;
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
  el.innerHTML = `
    <div style="position:absolute;width:50%;height:50%;top:-10%;right:-10%;background:radial-gradient(circle,${colors[0]},transparent 70%);filter:blur(60px);"></div>
    <div style="position:absolute;width:40%;height:40%;bottom:-5%;left:-5%;background:radial-gradient(circle,${colors[1]},transparent 70%);filter:blur(50px);"></div>
  `;
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

  let svgContent = "";
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < threshold) {
        const lineOp = Math.pow(1 - d / threshold, 1.5).toFixed(2);
        svgContent += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="currentColor" stroke-width="1" opacity="${lineOp}"/>`;
      }
    }
  }
  for (const n of nodes) {
    svgContent += `<circle cx="${n.x}" cy="${n.y}" r="${2 + rand() * 2}" fill="currentColor" opacity="${(0.4 + rand() * 0.3).toFixed(2)}"/>`;
  }

  const netColor = ctx.isDark ? "rgba(200,200,200,1)" : "rgba(80,80,80,1)";
  const el = createOverlay({ opacity: String(op), color: netColor });
  el.innerHTML = `<svg width="${ctx.pageWidth}" height="${ctx.pageHeight}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
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
