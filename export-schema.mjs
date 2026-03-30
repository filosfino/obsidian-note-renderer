/**
 * export-schema.mjs — Extract FIELD_SCHEMAS + EFFECT_SCHEMAS from schema.ts
 * and write a JSON-serialisable snapshot to the vault plugin directory.
 *
 * Called by esbuild onEnd hook (see esbuild.config.mjs).
 * Functions (toDisplay / fromDisplay) are stripped — JSON only carries data.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { transformSync } from "esbuild";
import yaml from "js-yaml";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(rootDir, "dist");

// ── Compile schema.ts to plain JS ──────────────────────────────────────────

const src = readFileSync(
  join(rootDir, "src/schema.ts"),
  "utf-8"
);

const { code } = transformSync(src, {
  loader: "ts",
  format: "cjs",
  target: "es2020",
});

// Evaluate in a CommonJS-like scope
const mod = { exports: {} };
new Function("module", "exports", code)(mod, mod.exports);
const exported = mod.exports;

const themeColorSrc = readFileSync(
  join(rootDir, "src/theme-colors.ts"),
  "utf-8"
);

const { code: themeColorCode } = transformSync(themeColorSrc, {
  loader: "ts",
  format: "cjs",
  target: "es2020",
});

const themeColorMod = { exports: {} };
new Function("module", "exports", themeColorCode)(themeColorMod, themeColorMod.exports);
const themeColors = themeColorMod.exports;

// ── Note-facing key mapping ─────────────────────────────────────────────────

const INTERNAL_TO_NOTE = exported.INTERNAL_TO_NOTE_KEY || {};

function noteKey(internalKey) {
  return INTERNAL_TO_NOTE[internalKey] || internalKey;
}

// ── Strip non-serialisable fields, use note-facing keys, convert display values

function cleanFieldSchemas(raw) {
  const out = {};
  for (const [key, schema] of Object.entries(raw)) {
    const { toDisplay, fromDisplay, ...rest } = schema;
    // Convert numeric min/max/default to display values when toDisplay exists
    if (toDisplay && rest.type === "number") {
      rest.default = parseFloat(toDisplay(rest.default));
      rest.min = parseFloat(toDisplay(rest.min));
      rest.max = parseFloat(toDisplay(rest.max));
      if (rest.step != null) {
        rest.step = parseFloat(toDisplay(rest.step));
      }
    }
    out[noteKey(key)] = rest;
  }
  return out;
}

function buildThemeColorSnapshot() {
  return {
    themeColorSchemas: themeColors.THEME_COLOR_SCHEMAS,
    themes: themeColors.BUILT_IN_THEME_COLOR_TOKENS,
  };
}

const output = {
  rendererConfigVersion: exported.RENDERER_CONFIG_VERSION,
  rendererConfigVersionKey: exported.RENDERER_CONFIG_VERSION_KEY,
  coverStrokeStyleUi: exported.COVER_STROKE_STYLE_UI,
  themeColorSchemas: themeColors.THEME_COLOR_SCHEMAS,
  fieldSchemas: cleanFieldSchemas(exported.FIELD_SCHEMAS),
  effectSchemas: exported.EFFECT_SCHEMAS,
  defaults: (() => {
    const defaults = {};
    for (const [key, schema] of Object.entries(exported.FIELD_SCHEMAS)) {
      // Defaults use display values when toDisplay exists
      const val = schema.toDisplay
        ? parseFloat(schema.toDisplay(schema.default))
        : schema.default;
      defaults[noteKey(key)] = val;
    }
    defaults.coverEffects = {};
    for (const [name, s] of Object.entries(exported.EFFECT_SCHEMAS)) {
      const params = { enabled: s.defaultEnabled, opacity: s.defaultOpacity };
      if (s.defaultCount != null) params.count = s.defaultCount;
      defaults.coverEffects[name] = params;
    }
    return defaults;
  })(),
};

writeFileSync(
  join(distDir, "schema.json"),
  JSON.stringify(output, null, 2) + "\n"
);

writeFileSync(
  join(distDir, "theme-colors.yaml"),
  yaml.dump(buildThemeColorSnapshot(), { indent: 2, lineWidth: -1, sortKeys: false })
);

console.log("  schema.json → dist/");
console.log("  theme-colors.yaml → dist/");
