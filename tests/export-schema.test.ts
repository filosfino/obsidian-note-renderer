import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("schema.json export contract", () => {
  it("exports the compact runtime schema without compatibility snapshots", () => {
    execFileSync("node", ["export-schema.mjs"], { cwd: process.cwd(), stdio: "ignore" });
    const schemaJson = JSON.parse(readFileSync(join(process.cwd(), "dist/schema.json"), "utf-8")) as Record<string, any>;

    expect(schemaJson.fieldSchemas.activeTheme.type).toBe("string");
    expect(schemaJson.fieldSchemas.coverFontScale.type).toBe("number");
    expect(schemaJson.fieldSchemas.coverFontOpacity.type).toBe("number");
    expect(schemaJson.effectSchemas.overlay.defaultEnabled).toBe(false);
    expect(schemaJson.effectSchemas.dots.defaultSpacing).toBe(28);
    expect(schemaJson.defaults.coverFontScale).toBe(100);
    expect(schemaJson.defaults.coverFontOpacity).toBe(100);
    expect(schemaJson.defaults.coverEffects.overlay.opacity).toBe(55);
    expect(schemaJson.defaults.coverEffects.bokeh.color).toBe("");
    expect(schemaJson.defaults.bodyEffects.grid.spacing).toBe(64);
    expect(schemaJson.coverStrokeStyleUi.double.doubleStroke.default).toBe(5);
    expect(schemaJson.themeColorSchemas).toBeUndefined();
    expect(schemaJson.flatFieldSchemas).toBeUndefined();
    expect(schemaJson.semanticDefaults).toBeUndefined();
  });
});
