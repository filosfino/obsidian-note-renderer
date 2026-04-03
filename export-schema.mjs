/**
 * export-schema.mjs — Export a compact JSON snapshot of the runtime render schema.
 *
 * Since note-level renderer_config has been removed, the export now mirrors the
 * plugin's actual flat runtime config instead of also shipping note-facing and
 * compatibility snapshots.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { transformSync } from "esbuild";
import yaml from "js-yaml";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(rootDir, "dist");

function evalTsModule(filePath) {
  const src = readFileSync(filePath, "utf-8");
  const { code } = transformSync(src, {
    loader: "ts",
    format: "cjs",
    target: "es2020",
  });

  const mod = { exports: {} };
  new Function("module", "exports", code)(mod, mod.exports);
  return mod.exports;
}

const schema = evalTsModule(join(rootDir, "src/schema.ts"));
const themeColors = evalTsModule(join(rootDir, "src/theme-colors.ts"));

function cleanSingleFieldSchema(fieldSchema) {
  const { toDisplay, fromDisplay, description, ...rest } = fieldSchema;
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

function cleanFieldSchemas(fieldSchemas) {
  return Object.fromEntries(
    Object.entries(fieldSchemas).map(([key, value]) => [key, cleanSingleFieldSchema(value)]),
  );
}

function cleanEffectSchemas(effectSchemas) {
  return Object.fromEntries(
    Object.entries(effectSchemas).map(([key, value]) => {
      const { description, ...rest } = value;
      return [key, rest];
    }),
  );
}

const output = {
  fieldSchemas: cleanFieldSchemas(schema.FIELD_SCHEMAS),
  effectSchemas: cleanEffectSchemas(schema.EFFECT_SCHEMAS),
  defaults: schema.RENDER_DEFAULTS,
  coverStrokeStyleUi: schema.COVER_STROKE_STYLE_UI,
};

writeFileSync(
  join(distDir, "schema.json"),
  JSON.stringify(output, null, 2) + "\n",
);

writeFileSync(
  join(distDir, "theme-colors.yaml"),
  yaml.dump({
    themeColorSchemas: themeColors.THEME_COLOR_SCHEMAS,
    themes: themeColors.BUILT_IN_THEME_COLOR_TOKENS,
  }, { indent: 2, lineWidth: -1, sortKeys: false }),
);

console.log("  schema.json → dist/");
console.log("  theme-colors.yaml → dist/");
