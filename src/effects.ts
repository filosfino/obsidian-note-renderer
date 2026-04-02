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

import { getPageWidth, type PageMode } from "./constants";
import { DAPPLED_SHAPES } from "./dappled-shapes";
import type { EffectParams } from "./schema";
import { detectThemeBrightness } from "./theme-colors";
export {
  deriveCoverStrokePalette,
  detectThemeBrightness,
  extractBodyTextColor,
  extractCoverTitleColor,
  extractPageBackgroundColor,
  extractThemeColorChoices,
  extractThemeColorValues,
  THEME_COLOR_SCHEMAS,
  type CoverStrokePalette,
  type ThemeColorChoice,
  type ThemeColorSchema,
} from "./theme-colors";

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

function colorToRgbaPrefix(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  if (color.startsWith("#")) {
    const raw = color.slice(1);
    const hex = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},`;
  }
  const parts = color.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return fallback;
  return `rgba(${Math.round(Number(parts[0]))},${Math.round(Number(parts[1]))},${Math.round(Number(parts[2]))},`;
}

// ── Effect renderers ────────────────────────────────────────────────────────

function renderGrain(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const id = `nr-grain-${Date.now()}`;
  const el = createOverlay({
    opacity: String(Math.min(1, op * 1.35)),
    mixBlendMode: ctx.effectBlend,
  });
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", `0 0 ${ctx.pageWidth} ${ctx.pageHeight}`);
  const filter = document.createElementNS(NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  const turb = document.createElementNS(NS, "feTurbulence");
  turb.setAttribute("type", "fractalNoise");
  turb.setAttribute("baseFrequency", ctx.isDark ? "0.95" : "0.85");
  turb.setAttribute("numOctaves", "2");
  turb.setAttribute("stitchTiles", "stitch");
  turb.setAttribute("result", "noise");
  filter.appendChild(turb);

  const mono = document.createElementNS(NS, "feColorMatrix");
  mono.setAttribute("in", "noise");
  mono.setAttribute("type", "saturate");
  mono.setAttribute("values", "0");
  mono.setAttribute("result", "monoNoise");
  filter.appendChild(mono);

  const contrast = document.createElementNS(NS, "feComponentTransfer");
  contrast.setAttribute("in", "monoNoise");
  contrast.setAttribute("result", "contrastNoise");
  for (const channel of ["R", "G", "B", "A"] as const) {
    const func = document.createElementNS(NS, `feFunc${channel}`);
    func.setAttribute("type", "gamma");
    func.setAttribute("amplitude", "1");
    func.setAttribute("exponent", ctx.isDark ? "1.9" : "1.6");
    func.setAttribute("offset", "0");
    contrast.appendChild(func);
  }
  filter.appendChild(contrast);

  svg.appendChild(filter);
  const rect = document.createElementNS(NS, "rect");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", ctx.isDark ? "white" : "black");
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
  const effectColor = colorToRgbaPrefix(params.color, ctx.effectColor);
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

    // Make the center feel lighter and more transparent; towards the edges the
    // bokeh becomes more solid so the title area stays cleaner.
    const dx = Math.abs(x - ctx.pageWidth / 2) / (ctx.pageWidth / 2);
    const dy = Math.abs(y - ctx.pageHeight / 2) / (ctx.pageHeight / 2);
    const centerDistance = Math.sqrt(dx * dx + dy * dy);
    const edgeWeight = Math.min(1, centerDistance / 0.8);
    const centerFade = 0.18 + 0.82 * edgeWeight;

    circles.push(`${x}px ${y}px 0 ${size}px ${effectColor}${(alpha * centerFade).toFixed(2)})`);
  }
  const dot = document.createElement("div");
  dot.setCssStyles({ position: "absolute", width: "1px", height: "1px", top: "0", left: "0", borderRadius: "50%", boxShadow: circles.join(",") });
  el.appendChild(dot);
  container.appendChild(el);
}

function renderDots(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const spacing = params.spacing ?? 28;
  const effectColor = colorToRgbaPrefix(params.color, ctx.effectColor);
  const dotAlpha = Math.min(0.45, 0.12 + op * 0.72);
  const dotSize = Math.max(1, params.size ?? Math.round(spacing * 0.14));
  const dotColor = `${effectColor}${dotAlpha.toFixed(2)})`;
  const el = createOverlay({
    opacity: String(Math.min(1, op * 1.1)),
    backgroundImage: `radial-gradient(circle, ${dotColor} 0, ${dotColor} ${dotSize}px, transparent ${dotSize + 1}px)`,
    backgroundSize: `${spacing}px ${spacing}px`,
    backgroundPosition: `${Math.round(spacing / 2)}px ${Math.round(spacing / 2)}px`,
  });
  container.appendChild(el);
}

function renderGrid(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const spacing = params.spacing ?? 60;
  const lineColor = ctx.isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  const lineWidth = 1;
  const remainderX = ctx.pageWidth % spacing;
  const remainderY = ctx.pageHeight % spacing;
  const offsetX = Math.round(remainderX / 2);
  const offsetY = Math.round(remainderY / 2);

  const el = createOverlay({
    opacity: String(op),
  });

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", String(ctx.pageWidth));
  svg.setAttribute("height", String(ctx.pageHeight));
  svg.setAttribute("viewBox", `0 0 ${ctx.pageWidth} ${ctx.pageHeight}`);
  svg.setAttribute("preserveAspectRatio", "none");

  for (let x = offsetX; x <= ctx.pageWidth; x += spacing) {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", String(x));
    line.setAttribute("y1", "0");
    line.setAttribute("x2", String(x));
    line.setAttribute("y2", String(ctx.pageHeight));
    line.setAttribute("stroke", lineColor);
    line.setAttribute("stroke-width", String(lineWidth));
    line.setAttribute("shape-rendering", "crispEdges");
    svg.appendChild(line);
  }

  for (let y = offsetY; y <= ctx.pageHeight; y += spacing) {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", String(y));
    line.setAttribute("x2", String(ctx.pageWidth));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", lineColor);
    line.setAttribute("stroke-width", String(lineWidth));
    line.setAttribute("shape-rendering", "crispEdges");
    svg.appendChild(line);
  }

  el.appendChild(svg);
  container.appendChild(el);
}

function renderDappledLight(container: HTMLElement, params: EffectParams, ctx: EffectContext): void {
  const op = params.opacity / 100;
  const mode = params.mode ?? "sunny";
  const shape = params.shape ?? "broad";
  const isBodyPage = container.classList.contains("nr-page-body");
  const palettes = {
    sunny: {
      ambient: "rgba(255,239,196,0.44)",
      beam: "rgba(255,219,143,0.82)",
      beamEdge: "rgba(222,170,94,0.40)",
      blinds: "rgba(156,121,69,0.22)",
      leaf: "rgba(255,247,215,0.94)",
      silhouette: "rgba(168,132,76,0.30)",
      blend: ctx.isDark ? "screen" : "normal",
    },
    rainy: {
      ambient: "rgba(213,225,239,0.34)",
      beam: "rgba(186,205,231,0.52)",
      beamEdge: "rgba(126,151,182,0.30)",
      blinds: "rgba(99,116,140,0.18)",
      leaf: "rgba(232,240,250,0.72)",
      silhouette: "rgba(94,116,146,0.24)",
      blend: ctx.isDark ? "screen" : "normal",
    },
    moonlight: {
      ambient: "rgba(181,199,233,0.26)",
      beam: "rgba(198,218,248,0.42)",
      beamEdge: "rgba(132,159,206,0.28)",
      blinds: "rgba(73,91,132,0.20)",
      leaf: "rgba(231,240,255,0.62)",
      silhouette: "rgba(78,98,144,0.22)",
      blend: ctx.isDark ? "screen" : "normal",
    },
  } as const;
  const palette = palettes[mode as keyof typeof palettes] ?? palettes.sunny;
  const opacityScale = isBodyPage ? 0.82 : 1;
  const blurScale = isBodyPage ? 1.15 : 1;
  const shapeBoost = shape === "palm" ? 1.24 : shape === "branch" ? 1.14 : 1;

  const overlay = createOverlay({
    opacity: String(Math.min(1, op * opacityScale)),
    mixBlendMode: palette.blend,
    overflow: "hidden",
  });

  const ambient = document.createElement("div");
  ambient.setCssStyles({
    position: "absolute",
    inset: "0",
    background: isBodyPage
      ? `radial-gradient(circle at 18% 10%, ${palette.ambient} 0%, transparent 34%)`
      : `radial-gradient(circle at 14% 8%, ${palette.ambient} 0%, transparent 42%)`,
  });
  overlay.appendChild(ambient);

  const blinds = document.createElement("div");
  blinds.setCssStyles({
    position: "absolute",
    inset: isBodyPage ? "-6%" : "-10%",
    transform: "rotate(-15deg) scale(1.04)",
    transformOrigin: "top left",
    backgroundImage: `repeating-linear-gradient(
      90deg,
      ${palette.blinds} 0px,
      ${palette.blinds} ${isBodyPage ? 18 : 24}px,
      transparent ${isBodyPage ? 18 : 24}px,
      transparent ${isBodyPage ? 86 : 98}px
    )`,
    filter: `blur(${(isBodyPage ? 10 : 8) * blurScale}px)`,
    opacity: isBodyPage ? "0.34" : mode === "sunny" ? "0.58" : "0.46",
  });
  overlay.appendChild(blinds);

  const beam = document.createElement("div");
  beam.setCssStyles({
    position: "absolute",
    width: isBodyPage ? "66%" : "82%",
    height: isBodyPage ? "38%" : "56%",
    left: isBodyPage ? "4%" : "-4%",
    top: isBodyPage ? "-2%" : "-5%",
    transform: "rotate(-15deg)",
    transformOrigin: "top left",
    background: `linear-gradient(92deg,
      transparent 0%,
      ${palette.beamEdge} 10%,
      ${palette.beam} 20%,
      ${palette.beam} 34%,
      ${palette.beamEdge} 45%,
      transparent 64%
    )`,
    filter: `blur(${(mode === "sunny" ? 34 : 28) * blurScale}px)`,
    opacity: isBodyPage ? (mode === "sunny" ? "0.34" : "0.26") : mode === "sunny" ? "0.74" : "0.54",
  });
  overlay.appendChild(beam);

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", String(ctx.pageWidth));
  svg.setAttribute("height", String(ctx.pageHeight));
  svg.setAttribute("viewBox", `0 0 ${ctx.pageWidth} ${ctx.pageHeight}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.overflow = "visible";
  svg.style.filter = `blur(${(mode === "sunny" ? 6 : 8) * blurScale}px)`;
  svg.style.opacity = isBodyPage
    ? String((mode === "sunny" ? 0.52 : mode === "rainy" ? 0.42 : 0.36) * shapeBoost)
    : String((mode === "sunny" ? 0.92 : mode === "rainy" ? 0.7 : 0.62) * shapeBoost);

  const defs = document.createElementNS(NS, "defs");
  const leafGradient = document.createElementNS(NS, "linearGradient");
  const gradientId = `nr-dappled-${mode}-${ctx.pageWidth}-${ctx.pageHeight}-${isBodyPage ? "body" : "cover"}`;
  leafGradient.setAttribute("id", gradientId);
  leafGradient.setAttribute("x1", "0%");
  leafGradient.setAttribute("y1", "0%");
  leafGradient.setAttribute("x2", "100%");
  leafGradient.setAttribute("y2", "100%");
  const stop1 = document.createElementNS(NS, "stop");
  stop1.setAttribute("offset", "0%");
  stop1.setAttribute("stop-color", palette.leaf);
  const stop2 = document.createElementNS(NS, "stop");
  stop2.setAttribute("offset", "100%");
  stop2.setAttribute("stop-color", palette.beam);
  stop2.setAttribute("stop-opacity", isBodyPage ? "0.45" : "0.68");
  leafGradient.appendChild(stop1);
  leafGradient.appendChild(stop2);
  defs.appendChild(leafGradient);
  svg.appendChild(defs);

  const currentLeafSet = DAPPLED_SHAPES[shape as keyof typeof DAPPLED_SHAPES] ?? DAPPLED_SHAPES.broad;
  for (const branchPath of currentLeafSet.branches) {
    const branch = document.createElementNS(NS, "path");
    branch.setAttribute("d", branchPath);
    branch.setAttribute("fill", "none");
    branch.setAttribute("stroke", palette.beamEdge);
    branch.setAttribute("stroke-width", String(currentLeafSet.branchWidth));
    branch.setAttribute("stroke-linecap", "round");
    branch.setAttribute("stroke-opacity", isBodyPage ? "0.26" : "0.4");
    svg.appendChild(branch);
  }
  for (let i = 0; i < currentLeafSet.leaves.length; i++) {
    if (!ctx.isDark) {
      const silhouette = document.createElementNS(NS, "path");
      silhouette.setAttribute("d", currentLeafSet.leaves[i]);
      silhouette.setAttribute("fill", palette.silhouette);
      silhouette.setAttribute("transform", currentLeafSet.transforms[i]);
      silhouette.setAttribute("fill-opacity", isBodyPage ? "0.38" : "0.5");
      svg.appendChild(silhouette);
    }
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", currentLeafSet.leaves[i]);
    path.setAttribute("fill", `url(#${gradientId})`);
    path.setAttribute("transform", currentLeafSet.transforms[i]);
    path.setAttribute("fill-opacity", String(currentLeafSet.leafOpacity ?? 1));
    svg.appendChild(path);
  }
  overlay.appendChild(svg);

  const edgeShade = document.createElement("div");
  edgeShade.setCssStyles({
    position: "absolute",
    inset: "0",
    background: isBodyPage
      ? "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, transparent 14%, transparent 100%)"
      : "linear-gradient(180deg, rgba(0,0,0,0.04) 0%, transparent 20%, transparent 100%)",
  });
  overlay.appendChild(edgeShade);

  container.appendChild(overlay);
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
  const scale = Math.max(0.5, params.width ?? 1);
  const lineWidth = scale;
  const bleedFactor = 0.7 + scale * 0.35;
  const rows = Math.round(cols * ctx.pageHeight / ctx.pageWidth);
  const cellW = ctx.pageWidth / cols;
  const cellH = ctx.pageHeight / rows;
  const threshold = Math.max(cellW, cellH) * (1.6 + (scale - 1) * 0.45);
  const bleedX = cellW * bleedFactor;
  const bleedY = cellH * bleedFactor;

  let seed = 42;
  const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };

  const nodes: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const baseX = cols <= 1 ? 0.5 : c / (cols - 1);
      const baseY = rows <= 1 ? 0.5 : r / (rows - 1);
      const x = -bleedX + baseX * (ctx.pageWidth + bleedX * 2) + (rand() - 0.5) * cellW * 0.75;
      const y = -bleedY + baseY * (ctx.pageHeight + bleedY * 2) + (rand() - 0.5) * cellH * 0.75;
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
        line.setAttribute("stroke-width", String(lineWidth));
        line.setAttribute("opacity", lineOp);
        svg.appendChild(line);
      }
    }
  }
  for (const n of nodes) {
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("cx", String(n.x));
    circle.setAttribute("cy", String(n.y));
    circle.setAttribute("r", String((2 + rand() * 2) * scale));
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
  dots: renderDots,
  grid: renderGrid,
  dappledLight: renderDappledLight,
  vignette: renderVignette,
  lightLeak: renderLightLeak,
  scanlines: renderScanlines,
  network: renderNetwork,
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Apply all enabled cover effects to a page element.
 * Iterates the registry — no hardcoded if-blocks needed.
 */
export function applyPageEffects(
  container: HTMLElement,
  effects: Record<string, EffectParams>,
  themeCss: string,
  pageMode: PageMode,
  pageHeight: number,
): void {
  const computedPosition = window.getComputedStyle(container).position;
  if (!computedPosition || computedPosition === "static") {
    container.setCssStyles({ position: "relative" });
  }
  container.setCssStyles({ overflow: "hidden" });

  const isDark = detectThemeBrightness(themeCss);
  const ctx: EffectContext = {
    pageWidth: getPageWidth(pageMode),
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

export const applyCoverEffects = applyPageEffects;
