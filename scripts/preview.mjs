#!/usr/bin/env node
/**
 * Standalone preview: render a note → headless Chrome → auto-paginate → screenshots.
 *
 * Uses the SAME pagination logic as the Obsidian plugin:
 *   - Render markdown at full resolution (1080×unlimited)
 *   - Measure each element's outer height (including margins)
 *   - Split into 1080×1440 pages at paragraph boundaries
 *   - Screenshot each page
 *
 * Usage:
 *   node scripts/preview.mjs <note.md> [--template cream] [--font-size 42] [--mode long|card] [--out /tmp/nr-preview]
 */

import { readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import puppeteer from "puppeteer-core";
import { marked } from "marked";

// ── Args ──
const args = process.argv.slice(2);
const mdPath = args.find((a) => !a.startsWith("--"));
if (!mdPath) {
  console.error("Usage: node scripts/preview.mjs <note.md> [--template ink-gold] [--font-size 42]");
  process.exit(1);
}
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

// ── Load Obsidian plugin settings as defaults ──
function loadPluginSettings() {
  // Walk up from note path to find .obsidian/plugins/note-renderer/data.json
  const candidates = [
    mdPath.includes("/4.projects/")
      ? join(mdPath.split("/4.projects/")[0], ".obsidian/plugins/note-renderer/data.json")
      : null,
    join(import.meta.dirname, "../../.obsidian/plugins/note-renderer/data.json"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, "utf-8"));
      } catch { /* ignore parse errors */ }
    }
  }
  return {};
}
const pluginSettings = loadPluginSettings();

// CLI args override plugin settings, plugin settings override hardcoded defaults
const templateName = getArg("template", pluginSettings.activeTemplate || "cream");
const fontSize = parseInt(getArg("font-size", String(pluginSettings.fontSize || 42)));
const fontFamily = getArg("font-family", pluginSettings.fontFamily || '"PingFang SC", "Noto Sans SC", sans-serif');
const coverFontFamily = getArg("cover-font", pluginSettings.coverFontFamily || '"Yuanti SC", "PingFang SC", sans-serif');
const pluginPageMode = pluginSettings.pageMode === "card" ? "card" : "long";
const pageMode = getArg("mode", pluginPageMode);
const outDir = getArg("out", "/tmp/nr-preview");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// ── Constants ──
const PAGE_WIDTH = 1080;
const PAGE_HEIGHTS = { long: 1800, card: 1440 };
const PAGE_HEIGHT = PAGE_HEIGHTS[pageMode] || 1800;
const PAGE_PADDING_H = 90;
const PAGE_PADDING_TOP = 120;
const PAGE_PADDING_BOTTOM = 90;
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;

// ── Load template CSS from TS source ──
function loadTemplateCss(name) {
  const file = join(import.meta.dirname, `../src/templates/${name}.ts`);
  if (!existsSync(file)) {
    console.error(`Unknown template: ${name}`);
    process.exit(1);
  }
  const content = readFileSync(file, "utf-8");
  const match = content.match(/`([\s\S]+?)`/);
  let css = match ? match[1] : "";
  // Fix escaped unicode: \\201C → \201C for CSS
  css = css.replace(/\\\\([0-9a-fA-F]{4})/g, "\\$1");
  return css;
}

// ── Parse note (same as src/parser.ts) ──
function parseNote(md) {
  // Strip frontmatter
  const fm = md.match(/^---\n[\s\S]*?\n---\n?/);
  const stripped = fm ? md.slice(fm[0].length) : md;

  // Split H2 sections
  const sections = [];
  const regex = /^## (.+)$/gm;
  const matches = [];
  let m;
  while ((m = regex.exec(stripped)) !== null) {
    matches.push({ heading: m[1].trim(), index: m.index, full: m[0] });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].full.length;
    const end = i + 1 < matches.length ? matches[i + 1].index : stripped.length;
    sections.push({ heading: matches[i].heading, content: stripped.slice(start, end) });
  }

  const titleSec = sections.find((s) => s.heading === "标题");
  const coverSec = sections.find((s) => s.heading === "封面文字") || sections.find((s) => s.heading === "封面");
  const coverImageSec = sections.find((s) => s.heading === "封面图");
  const bodySec = sections.find((s) => s.heading === "正文");

  const title = titleSec
    ? titleSec.content.trim().split("\n").filter((l) => l.trim())[0]?.trim() || ""
    : (stripped.match(/^# (.+)$/m)?.[1]?.trim() || "Untitled");

  return {
    title,
    coverMarkdown: coverSec ? coverSec.content.trim() : null,
    coverImageMarkdown: coverImageSec ? coverImageSec.content.trim() : null,
    bodyMarkdown: bodySec ? bodySec.content.trim() : "",
  };
}

// ── Cover text autosize ──
function autosizeStyle(text) {
  const len = text.replace(/<[^>]+>/g, "").trim().length;
  let fs;
  if (len <= 4) fs = 128;
  else if (len <= 8) fs = 108;
  else if (len <= 12) fs = 88;
  else if (len <= 16) fs = 72;
  else if (len <= 24) fs = 60;
  else fs = 48;
  return `font-size:${fs}px; font-weight:800; line-height:1.3;`;
}

// ── Build HTML ──
const md = readFileSync(mdPath, "utf-8");
const note = parseNote(md);
const templateCss = loadTemplateCss(templateName);

const fontOverride = `
.nr-page {
  font-size: ${fontSize}px;
  font-family: ${fontFamily};
  line-height: 1.75;
  letter-spacing: 0.05em;
}
.nr-page-cover .nr-cover-content {
  font-family: ${coverFontFamily};
}`;

function renderMd(text) {
  // Same preprocessing as src/md-to-html.ts — must stay in sync

  // Obsidian image embeds: ![[file]] → standard markdown image
  // Ensure images are on their own line for proper pagination
  text = text.replace(/!\[\[([^\]]+)\]\]/g, (_, name) => {
    const vaultRoot = mdPath.includes("/4.projects/")
      ? mdPath.split("/4.projects/")[0]
      : join(import.meta.dirname, "../..");
    const imgPath = join(vaultRoot, "attachments", name);
    const src = existsSync(imgPath) ? `file://${imgPath}` : name;
    return `\n\n![${name}](${src})\n\n`;
  });

  // Also split standard markdown images that are inline with text
  text = text.replace(/([^\n])(!\[[^\]]*\]\([^)]+\))/g, "$1\n\n$2");
  text = text.replace(/(!\[[^\]]*\]\([^)]+\))([^\n])/g, "$1\n\n$2");

  // Strip wikilinks to plain text
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2"); // [[target|alias]] → alias
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1"); // [[target]] → target

  return marked.parse(text, { breaks: false, gfm: true });
}

// Resolve cover image to file:// URL
function resolveCoverImage() {
  if (!note.coverImageMarkdown) return null;
  const imgMatch = note.coverImageMarkdown.match(/!\[\[([^\]]+)\]\]/);
  if (!imgMatch) return null;
  const name = imgMatch[1];
  const vaultRoot = mdPath.includes("/4.projects/")
    ? mdPath.split("/4.projects/")[0]
    : join(import.meta.dirname, "../..");
  const imgPath = join(vaultRoot, "attachments", name);
  return existsSync(imgPath) ? `file://${imgPath}` : null;
}

// Cover HTML
function buildCoverHtml() {
  const coverImageUrl = resolveCoverImage();
  let textHtml;

  if (note.coverMarkdown) {
    textHtml = renderMd(note.coverMarkdown);
    textHtml = textHtml.replace(/<p>([\s\S]*?)<\/p>/g, (_, content) => {
      // Skip autosize if content already has inline styles (user-controlled)
      if (content.includes('style=')) {
        return `<p style="font-weight:800; line-height:1.3;">${content}</p>`;
      }
      const text = content.replace(/<[^>]+>/g, "").trim();
      return `<p style="${autosizeStyle(text)}">${content}</p>`;
    });
  } else {
    const style = autosizeStyle(note.title);
    textHtml = `<h1 style="${style}">${note.title}</h1>`;
  }

  if (!coverImageUrl) return textHtml;

  // Cover image as background, text overlaid on top
  return `<img src="${coverImageUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:16px;z-index:0;">
<div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;padding:${PAGE_PADDING_TOP}px ${PAGE_PADDING_H}px ${PAGE_PADDING_BOTTOM}px;">${textHtml}</div>`;
}

// Build the full HTML document
// Body content goes into a single tall container for measurement,
// then client-side JS does the pagination
const coverHtml = buildCoverHtml();
const bodyHtml = renderMd(note.bodyMarkdown);

const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
${templateCss}
${fontOverride}

.nr-page {
  width: ${PAGE_WIDTH}px;
  height: ${PAGE_HEIGHT}px;
  padding: ${PAGE_PADDING_TOP}px ${PAGE_PADDING_H}px ${PAGE_PADDING_BOTTOM}px;
  overflow: hidden;
  position: relative;
}

.nr-cover-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  height: 100%;
  position: relative;
}

/* Measurer: same width/padding, no height limit */
#measurer {
  position: absolute;
  left: -9999px;
  top: 0;
  width: ${PAGE_WIDTH}px;
  padding: ${PAGE_PADDING_TOP}px ${PAGE_PADDING_H}px ${PAGE_PADDING_BOTTOM}px;
}
#measurer .nr-page-content {
  /* inherits font from .nr-page via template CSS won't apply here,
     so set explicitly */
  font-size: ${fontSize}px;
  font-family: ${fontFamily};
  line-height: 1.75;
  letter-spacing: 0.05em;
}

.nr-page-content p {
  text-align: justify;
  word-break: normal;
  overflow-wrap: break-word;
}

.nr-page-content img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 16px auto;
  border-radius: 8px;
}

.nr-page-content .image-embed,
.nr-page-content span:has(> img),
.nr-page-content .internal-embed {
  display: block;
  width: 100%;
  max-width: 100%;
}

body { margin: 0; padding: 0; background: #000; }
#pages { display: none; }
</style>
</head>
<body>

<!-- Hidden measurer for height calculation -->
<div id="measurer">
  <div class="nr-page">
    <div class="nr-page-content" id="body-content">
      ${bodyHtml}
    </div>
  </div>
</div>

<!-- Pages will be built by JS -->
<div id="pages"></div>

<script>
const PAGE_HEIGHT = ${PAGE_HEIGHT};
const PAGE_PADDING_TOP = ${PAGE_PADDING_TOP};
const PAGE_PADDING_BOTTOM = ${PAGE_PADDING_BOTTOM};
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;

function outerHeight(el) {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return rect.height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
}

function paginate() {
  const container = document.getElementById('body-content');
  const children = Array.from(container.children);
  const pages = [];
  let current = [];
  let height = 0;

  for (const el of children) {
    if (el.offsetHeight === 0) continue;
    if (el.tagName === 'HR') {
      if (current.length > 0) {
        pages.push(current);
        current = [];
        height = 0;
      }
      continue;
    }
    const h = outerHeight(el);
    if (h > CONTENT_HEIGHT && current.length === 0) {
      pages.push([el.outerHTML]);
      height = 0;
      continue;
    }
    if (height + h > CONTENT_HEIGHT && current.length > 0) {
      pages.push(current);
      current = [];
      height = 0;
    }
    current.push(el.outerHTML);
    height += h;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

// Wait for all images to load before paginating
async function waitForImages() {
  const imgs = document.querySelectorAll('#body-content img');
  await Promise.all(Array.from(imgs).map(img =>
    img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
  ));
}

async function main() {
await waitForImages();

const coverHtml = \`${coverHtml.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`;
const bodyPages = paginate();

const pagesContainer = document.getElementById('pages');

// Cover page
const coverDiv = document.createElement('div');
coverDiv.className = 'nr-page nr-page-cover';
const hasCoverImage = coverHtml.includes('nr-cover-bg-image') || coverHtml.includes('object-fit:cover');
if (hasCoverImage) {
  // Cover image mode: HTML already has absolute image + overlay div with padding
  coverDiv.style.padding = '0';
  coverDiv.innerHTML = coverHtml;
} else {
  coverDiv.innerHTML = '<div class="nr-cover-content">' + coverHtml + '</div>';
}
pagesContainer.appendChild(coverDiv);

// Body pages
bodyPages.forEach(elements => {
  const pageDiv = document.createElement('div');
  pageDiv.className = 'nr-page nr-page-body';
  pageDiv.innerHTML = '<div class="nr-page-content">' + elements.join('') + '</div>';
  pagesContainer.appendChild(pageDiv);
});

pagesContainer.style.display = 'block';
document.getElementById('measurer').remove();

// Signal done
window.__pagesReady = true;
window.__pageCount = 1 + bodyPages.length;
}
main();
</script>
</body></html>`;

// ── Render with Puppeteer ──
mkdirSync(outDir, { recursive: true });

console.log(`Rendering "${note.title}" with template=${templateName}, fontSize=${fontSize}px...`);

// Write HTML to file so Chrome can load file:// images
const { writeFileSync } = await import("fs");
const htmlPath = join(outDir, "preview.html");
writeFileSync(htmlPath, fullHtml);

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: "new",
  args: [
    `--window-size=${PAGE_WIDTH},${PAGE_HEIGHT}`,
    "--allow-file-access-from-files",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT, deviceScaleFactor: 1 });
await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });

// Wait for pagination JS to complete
await page.waitForFunction("window.__pagesReady === true", { timeout: 10000 });
const pageCount = await page.evaluate(() => window.__pageCount);
console.log(`Generated ${pageCount} pages`);

// Screenshot each page
const pageElements = await page.$$("#pages > .nr-page");
for (let i = 0; i < pageElements.length; i++) {
  const pngPath = join(outDir, `page_${String(i).padStart(2, "0")}.png`);
  await pageElements[i].screenshot({ path: pngPath });
  console.log(`  ✓ ${pngPath}`);
}

await browser.close();
console.log(`\nDone. ${pageCount} pages at ${outDir}/`);
