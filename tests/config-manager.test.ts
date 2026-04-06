import { describe, expect, it } from "vitest";
import {
  buildCoverConfig,
  mergeConfigs,
  readNoteConfig,
  readNoteConfigMetadata,
  resolveMergedRenderConfig,
  saveNoteConfig,
} from "../src/config-manager";
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

  it("saves preset-backed note config as presetName plus only changed fields", () => {
    const presetBase = createDefaultRendererConfig();
    const noteOptions = {
      ...presetBase,
      fontSize: presetBase.fontSize + 2,
      coverEffects: {
        ...presetBase.coverEffects,
        overlay: {
          ...presetBase.coverEffects.overlay,
          enabled: true,
          opacity: 70,
        },
      },
    };

    const markdown = saveNoteConfig("# Note\n", noteOptions, { activePreset: "default" }, presetBase);

    expect(markdown).toContain("presetName: default");
    expect(markdown).toContain("fontSize:");
    expect(markdown).not.toContain(`activeTheme: ${presetBase.activeTheme}`);
    expect(markdown).toContain("overlay:");
    expect(markdown).not.toContain("grid:");

    expect(readNoteConfigMetadata(markdown)).toEqual({ activePreset: "default" });
    expect(readNoteConfig(markdown)).toEqual({
      fontSize: presetBase.fontSize + 2,
      coverEffects: {
        overlay: {
          enabled: true,
          opacity: 70,
        },
      },
    });
  });

  it("keeps reading legacy full note config dumps that also include presetName", () => {
    const markdown = `---
renderer_config:
  presetName: default
  activeTheme: cream
  fontSize: 30
---

# Note
`;

    expect(readNoteConfigMetadata(markdown)).toEqual({ activePreset: "default" });
    expect(readNoteConfig(markdown)).toEqual({
      activeTheme: "cream",
      fontSize: 30,
    });
  });

  it("uses the updated shadow defaults for blur and offsets", () => {
    const base = createDefaultRendererConfig();
    const cover = buildCoverConfig(base);

    expect(base.coverShadowBlur).toBe(6);
    expect(base.coverShadowOffsetX).toBe(6);
    expect(base.coverShadowOffsetY).toBe(6);
    expect(base.coverShadowColor).toBe("rgba(0,0,0,0.6)");
    expect(cover.shadow).toMatchObject({
      blur: 6,
      offsetX: 6,
      offsetY: 6,
      color: "rgba(0,0,0,0.6)",
    });
  });
});
