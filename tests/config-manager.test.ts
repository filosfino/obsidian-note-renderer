import { describe, expect, it } from "vitest";
import { mergeConfigs, resolveMergedRenderConfig } from "../src/config-manager";
import { createDefaultRendererConfig } from "../src/plugin-types";

describe("config-manager", () => {
  it("deep-merges effect overrides without dropping untouched defaults", () => {
    const base = createDefaultRendererConfig();
    const merged = mergeConfigs(base, {
      fontSize: 30,
      coverEffects: {
        overlay: {
          enabled: true,
          opacity: 70,
        },
      },
    });

    expect(merged.fontSize).toBe(30);
    expect(merged.coverEffects.overlay).toMatchObject({
      enabled: true,
      opacity: 70,
    });
    expect(merged.coverEffects.grid).toEqual(base.coverEffects.grid);
  });

  it("builds resolved render config from the merged runtime settings", () => {
    const base = createDefaultRendererConfig();
    const resolved = resolveMergedRenderConfig(base, {
      activeTheme: "cream",
      coverFontScale: 180,
    });

    expect(resolved.settings.activeTheme).toBe("cream");
    expect(resolved.options.coverFontScale).toBe(180);
    expect(resolved.cover.typography.scale).toBe(180);
  });
});
