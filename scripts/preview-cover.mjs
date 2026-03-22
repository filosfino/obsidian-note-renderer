#!/usr/bin/env node
/**
 * Quick cover-only preview. Much faster than full preview.
 * Usage: node scripts/preview-cover.mjs <note.md> [--theme dark-gold] [--font font-family]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import puppeteer from "puppeteer-core";
import { marked } from "marked";

const args = process.argv.slice(2);
const mdPath = args.find(a => !a.startsWith("--"));
function getArg(name, fb) { const i = args.indexOf(`--${name}`); return i >= 0 && args[i+1] ? args[i+1] : fb; }

const themeName = getArg("theme", "cream");
const titleFont = getArg("font", '"PingFang SC", "Noto Sans SC", sans-serif');
const outDir = "/tmp/nr-preview";

// Load theme CSS
const tsFile = readFileSync(join(import.meta.dirname, `../src/themes/${templateName}.ts`), "utf8");
const cssMatch = tsFile.match(/`([\s\S]+?)`/);
let css = cssMatch ? cssMatch[1].replace(/\\\\([0-9a-fA-F]{4})/g, "\\$1") : "";

// Parse note
const md = readFileSync(mdPath, "utf8");
const fm = md.match(/^---\n[\s\S]*?\n---\n?/);
const stripped = fm ? md.slice(fm[0].length) : md;
const sections = [];
const regex = /^## (.+)$/gm;
const matches = [];
let m;
while ((m = regex.exec(stripped)) !== null) matches.push({ h: m[1].trim(), i: m.index, f: m[0] });
for (let i = 0; i < matches.length; i++) {
  const s = matches[i].i + matches[i].f.length;
  const e = i + 1 < matches.length ? matches[i + 1].i : stripped.length;
  sections.push({ heading: matches[i].h, content: stripped.slice(s, e) });
}

const coverSec = sections.find(s => s.heading === "封面");
const titleSec = sections.find(s => s.heading === "标题");
let coverHtml;
if (coverSec) {
  coverHtml = marked.parse(coverSec.content.trim());
} else {
  const title = titleSec ? titleSec.content.trim().split("\n")[0] : "Untitled";
  coverHtml = `<h1>${title}</h1>`;
}

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
${css}
.nr-page {
  width: 1080px; height: 1800px; padding: 120px 90px 90px;
  overflow: hidden; position: relative;
  font-family: ${titleFont};
}
.nr-cover-content {
  display: flex; flex-direction: column; justify-content: center;
  align-items: flex-start; height: 100%; position: relative;
}
body { margin: 0; }
</style></head><body>
<div class="nr-page nr-page-cover"><div class="nr-cover-content">${coverHtml}</div></div>
</body></html>`;

mkdirSync(outDir, { recursive: true });
const htmlPath = join(outDir, "cover.html");
writeFileSync(htmlPath, html);

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1800, deviceScaleFactor: 1 });
await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
const el = await page.$(".nr-page");
await el.screenshot({ path: join(outDir, "cover.png") });
await browser.close();
console.log(`Done: ${outDir}/cover.png`);
