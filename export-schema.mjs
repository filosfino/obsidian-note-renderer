/**
 * export-schema.mjs — Extract FIELD_SCHEMAS + EFFECT_SCHEMAS from schema.ts
 * and write a JSON-serialisable snapshot to the vault plugin directory.
 *
 * Called by esbuild onEnd hook (see esbuild.config.mjs).
 * Functions (toDisplay / fromDisplay) are stripped — JSON only carries data.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { transformSync } from "esbuild";

const VAULT_PLUGIN_DIR = join(
  process.env.HOME,
  "projects/obsidian-knowledge/.obsidian/plugins/note-renderer"
);

// ── Compile schema.ts to plain JS ──────────────────────────────────────────

const src = readFileSync(
  join(import.meta.dirname, "src/schema.ts"),
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

// ── Strip non-serialisable fields & write ──────────────────────────────────

function cleanFieldSchemas(raw) {
  const out = {};
  for (const [key, schema] of Object.entries(raw)) {
    const { toDisplay, fromDisplay, ...rest } = schema;
    out[key] = rest;
  }
  return out;
}

const output = {
  fieldSchemas: cleanFieldSchemas(exported.FIELD_SCHEMAS),
  effectSchemas: exported.EFFECT_SCHEMAS,
  defaults: (() => {
    // Reconstruct defaults without functions
    const defaults = {};
    for (const [key, schema] of Object.entries(exported.FIELD_SCHEMAS)) {
      defaults[key] = schema.default;
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
  join(VAULT_PLUGIN_DIR, "schema.json"),
  JSON.stringify(output, null, 2) + "\n"
);

console.log("  schema.json → .obsidian/plugins/note-renderer/");
