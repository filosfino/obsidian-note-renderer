import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("schema.json export contract", () => {
  it("exports grouped schema as primary output and keeps flat compatibility snapshots", () => {
    execFileSync("node", ["export-schema.mjs"], { cwd: process.cwd(), stdio: "ignore" });
    const schemaJson = JSON.parse(readFileSync(join(process.cwd(), "dist/schema.json"), "utf-8")) as Record<string, any>;

    expect(schemaJson.rendererConfigVersion).toBe(1);
    expect(schemaJson.fieldSchemas.theme.type).toBe("string");
    expect(schemaJson.fieldSchemas.cover.typography.scale.type).toBe("number");
    expect(schemaJson.fieldSchemas.cover.typography.opacity.type).toBe("number");
    expect(schemaJson.fieldSchemas.cover.banner.paddingPercent.type).toBe("number");
    expect(schemaJson.fieldSchemas.cover.effects.overlay.enabled.type).toBe("boolean");
    expect(schemaJson.fieldSchemas.cover.effects.bokeh.color.type).toBe("string");
    expect(schemaJson.fieldSchemas.cover.effects.dots.spacing.type).toBe("number");
    expect(schemaJson.fieldSchemas.cover.effects.dots.size.type).toBe("number");
    expect(schemaJson.fieldSchemas.cover.effects.dots.color.type).toBe("string");
    expect(schemaJson.fieldSchemas.cover.effects.grid.spacing.type).toBe("number");
    expect(schemaJson.fieldSchemas.cover.effects.network.width.type).toBe("number");
    expect(schemaJson.defaults.cover.typography.opacity).toBe(100);
    expect(schemaJson.defaults.cover.typography.scale).toBe(150);
    expect(schemaJson.defaults.cover.banner.paddingPercent).toBe(40);
    expect(schemaJson.defaults.cover.effects.overlay.opacity).toBe(55);
    expect(schemaJson.defaults.cover.effects.bokeh.color).toBe("");
    expect(schemaJson.defaults.cover.effects.dots.spacing).toBe(28);
    expect(schemaJson.defaults.cover.effects.dots.size).toBe(4);
    expect(schemaJson.defaults.cover.effects.dots.color).toBe("");
    expect(schemaJson.defaults.cover.effects.grid.spacing).toBe(60);
    expect(schemaJson.defaults.cover.effects.network.width).toBe(1);

    expect(schemaJson.flatFieldSchemas.coverFontOpacity.type).toBe("number");
    expect(schemaJson.flatFieldSchemas.coverFontScale.type).toBe("number");
    expect(schemaJson.flatDefaults.coverEffects.overlay.opacity).toBe(55);
  });
});
