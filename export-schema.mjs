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
const COVER_FIELD_PATHS = {
  coverFontFamily: ["cover", "typography", "fontFamily"],
  coverFontColor: ["cover", "typography", "color"],
  coverFontOpacity: ["cover", "typography", "opacity"],
  coverFontScale: ["cover", "typography", "scale"],
  coverFontWeight: ["cover", "typography", "weight"],
  coverLetterSpacing: ["cover", "typography", "letterSpacing"],
  coverLineHeight: ["cover", "typography", "lineHeight"],
  coverTextAlign: ["cover", "typography", "align"],
  coverOffsetX: ["cover", "position", "offsetX"],
  coverOffsetY: ["cover", "position", "offsetY"],
  coverStrokeStyle: ["cover", "stroke", "style"],
  coverStrokeOpacity: ["cover", "stroke", "opacity"],
  coverStrokePercent: ["cover", "stroke", "inner", "widthPercent"],
  coverStrokeColor: ["cover", "stroke", "inner", "color"],
  coverDoubleStrokePercent: ["cover", "stroke", "outer", "widthPercent"],
  coverDoubleStrokeColor: ["cover", "stroke", "outer", "color"],
  coverGlow: ["cover", "glow", "enabled"],
  coverGlowSize: ["cover", "glow", "size"],
  coverGlowColor: ["cover", "glow", "color"],
  coverShadow: ["cover", "shadow", "enabled"],
  coverShadowBlur: ["cover", "shadow", "blur"],
  coverShadowOffsetX: ["cover", "shadow", "offsetX"],
  coverShadowOffsetY: ["cover", "shadow", "offsetY"],
  coverShadowColor: ["cover", "shadow", "color"],
  coverBanner: ["cover", "banner", "enabled"],
  coverBannerColor: ["cover", "banner", "color"],
  coverBannerSkew: ["cover", "banner", "skew"],
  coverBannerPaddingPercent: ["cover", "banner", "paddingPercent"],
};

function noteKey(internalKey) {
  return INTERNAL_TO_NOTE[internalKey] || internalKey;
}

// ── Strip non-serialisable fields, use note-facing keys, convert display values

function setNestedValue(target, path, value) {
  let current = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
}

function cleanSingleFieldSchema(schema) {
  const { toDisplay, fromDisplay, ...rest } = schema;
  if (toDisplay && rest.type === "number") {
    rest.default = parseFloat(toDisplay(rest.default));
    rest.min = parseFloat(toDisplay(rest.min));
    rest.max = parseFloat(toDisplay(rest.max));
    if (rest.step != null) {
      rest.step = parseFloat(toDisplay(rest.step));
    }
  }
  return rest;
}

function cleanFieldSchemas(raw) {
  const out = {};
  for (const [key, schema] of Object.entries(raw)) {
    out[noteKey(key)] = cleanSingleFieldSchema(schema);
  }
  return out;
}

function buildGroupedFieldSchemas(fieldSchemas, effectSchemas) {
  const grouped = {};

  for (const [key, schema] of Object.entries(fieldSchemas)) {
    const cleanSchema = cleanSingleFieldSchema(schema);
    const path = COVER_FIELD_PATHS[key];
    if (path) {
      setNestedValue(grouped, path, cleanSchema);
    } else {
      grouped[noteKey(key)] = cleanSchema;
    }
  }

  grouped.cover ||= {};
  grouped.cover.effects = {};
  for (const [name, schema] of Object.entries(effectSchemas)) {
    const effectSchema = {
      label: schema.label,
      description: schema.description,
      enabled: {
        type: "boolean",
        default: schema.defaultEnabled,
      },
      opacity: {
        type: "number",
        default: schema.defaultOpacity,
        min: schema.min,
        max: schema.max,
      },
    };
    if (schema.defaultCount != null) {
      effectSchema.count = {
        type: "number",
        default: schema.defaultCount,
        min: schema.countMin,
        max: schema.countMax,
        step: 1,
      };
    }
    if (schema.defaultWidth != null) {
      effectSchema.width = {
        type: "number",
        default: schema.defaultWidth,
        min: schema.widthMin,
        max: schema.widthMax,
        step: schema.widthStep ?? 1,
      };
    }
    if (schema.defaultSpacing != null) {
      effectSchema.spacing = {
        type: "number",
        default: schema.defaultSpacing,
        min: schema.spacingMin,
        max: schema.spacingMax,
        step: schema.spacingStep ?? 1,
      };
    }
    if (schema.defaultSize != null) {
      effectSchema.size = {
        type: "number",
        default: schema.defaultSize,
        min: schema.sizeMin,
        max: schema.sizeMax,
        step: schema.sizeStep ?? 1,
      };
    }
    if (schema.defaultColor != null) {
      effectSchema.color = {
        type: "string",
        default: schema.defaultColor,
      };
    }
    grouped.cover.effects[name] = effectSchema;
  }

  return grouped;
}

function buildFlatDefaults(fieldSchemas, effectSchemas) {
  const defaults = {};
  for (const [key, schema] of Object.entries(fieldSchemas)) {
    const val = schema.toDisplay
      ? parseFloat(schema.toDisplay(schema.default))
      : schema.default;
    defaults[noteKey(key)] = val;
  }
  defaults.coverEffects = {};
  for (const [name, s] of Object.entries(effectSchemas)) {
    const params = { enabled: s.defaultEnabled, opacity: s.defaultOpacity };
    if (s.defaultCount != null) params.count = s.defaultCount;
    if (s.defaultWidth != null) params.width = s.defaultWidth;
    if (s.defaultSpacing != null) params.spacing = s.defaultSpacing;
    if (s.defaultSize != null) params.size = s.defaultSize;
    if (s.defaultColor != null) params.color = s.defaultColor;
    defaults.coverEffects[name] = params;
  }
  return defaults;
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
  coverSemanticSchema: exported.COVER_SEMANTIC_SCHEMA,
  themeColorSchemas: themeColors.THEME_COLOR_SCHEMAS,
  fieldSchemas: buildGroupedFieldSchemas(exported.FIELD_SCHEMAS, exported.EFFECT_SCHEMAS),
  flatFieldSchemas: cleanFieldSchemas(exported.FIELD_SCHEMAS),
  effectSchemas: exported.EFFECT_SCHEMAS,
  defaults: exported.toSemanticNoteConfig(exported.toNoteConfigKeys(exported.RENDER_DEFAULTS)),
  flatDefaults: buildFlatDefaults(exported.FIELD_SCHEMAS, exported.EFFECT_SCHEMAS),
  coverDefaults: exported.buildCoverConfig(exported.RENDER_DEFAULTS),
  semanticDefaults: exported.toSemanticNoteConfig(exported.toNoteConfigKeys(exported.RENDER_DEFAULTS)),
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
