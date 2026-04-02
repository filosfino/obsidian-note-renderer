import { describe, expect, it } from "vitest";
import { readGroupedNoteConfig, readNoteConfig, writeGroupedNoteConfig } from "../src/config-manager";

describe("renderer_config migration", () => {
  it("reads legacy flat config as latest grouped schema", () => {
    const markdown = `
# Test Note

## renderer_config

\`\`\`yaml
theme: graphite
coverFontColor: "#ffffff"
coverGlow: true
coverOverlay: true
coverOverlayOpacity: 70
\`\`\`
`;

    const grouped = readGroupedNoteConfig(markdown);

    expect(grouped?.rendererConfigVersion).toBe(1);
    expect(grouped?.theme).toBe("graphite");
    expect(grouped?.cover).toMatchObject({
      glow: { enabled: true },
      typography: { color: "#ffffff" },
      effects: {
        overlay: { enabled: true, opacity: 70 },
      },
    });
  });

  it("writes grouped schema back even when input uses legacy flat keys", () => {
    const markdown = `
# Test Note

## 正文

hello
`;

    const updated = writeGroupedNoteConfig(markdown, {
      theme: "cream",
      coverFontScale: 180,
      coverStrokeStyle: "double",
      coverDoubleStrokePercent: 8,
      coverBokeh: true,
      coverBokehOpacity: 22,
    });

    expect(updated).toContain("rendererConfigVersion: 1");
    expect(updated).toContain("theme: cream");
    expect(updated).toContain("cover:");
    expect(updated).toContain("typography:");
    expect(updated).toContain("scale: 180");
    expect(updated).toContain("stroke:");
    expect(updated).toContain("style: double");
    expect(updated).toContain("widthPercent: 8");
    expect(updated).toContain("effects:");
    expect(updated).toContain("bokeh:");
    expect(updated).toContain("opacity: 22");
    expect(updated).not.toContain("coverFontScale:");
    expect(updated).not.toContain("coverBokehOpacity:");
  });

  it("does not write legacy coverPagePaddingX default 90 back to grouped config", () => {
    const markdown = `
# Test Note

## 正文

hello
`;

    const updated = writeGroupedNoteConfig(markdown, {
      pageMode: "card",
      coverPagePaddingX: 90,
    });

    expect(updated).not.toContain("paddingX: 90");
  });

  it("normalizes legacy visual defaults when reading", () => {
    const markdown = `---
renderer_config:
  coverGlowSize: 60
  coverShadowBlur: 42
  coverShadowOffsetX: 5
  coverShadowOffsetY: 10
  coverEffects:
    grid:
      enabled: true
      opacity: 36
      spacing: 60
---

# Test Note
`;

    const config = readNoteConfig(markdown);

    expect(config?.coverGlowSize).toBe(60);
    expect(config?.coverShadowBlur).toBe(42);
    expect(config?.coverShadowOffsetX).toBe(5);
    expect(config?.coverShadowOffsetY).toBe(10);
    expect(config?.coverEffects?.grid?.spacing).toBe(60);
  });

  it("prefers frontmatter renderer_config over H2 renderer_config when reading", () => {
    const markdown = `---
renderer_config:
  theme: mist
  presetName: Daily Challenge
  cover:
    typography:
      scale: 160
---

# Test Note

## renderer_config

\`\`\`yaml
theme: cream
coverFontScale: 120
\`\`\`
`;

    const grouped = readGroupedNoteConfig(markdown);

    expect(grouped).toMatchObject({
      theme: "mist",
      presetName: "Daily Challenge",
      cover: {
        typography: {
          scale: 160,
        },
      },
    });
  });

  it("writes renderer_config to frontmatter and removes legacy H2 config", () => {
    const markdown = `---
title: Test
---

# Test Note

## renderer_config

\`\`\`yaml
theme: cream
fontSize: 28
\`\`\`

## 正文

hello
`;

    const updated = writeGroupedNoteConfig(markdown, {
      theme: "mist",
      fontSize: 30,
      activePreset: "Daily Challenge",
    });

    expect(updated).toContain("renderer_config:");
    expect(updated).toContain("theme: mist");
    expect(updated).toContain("fontSize: 30");
    expect(updated).toContain("presetName: Daily Challenge");
    expect((updated.match(/\n## renderer_config\n/g) ?? []).length).toBe(0);
  });

  it("reads preset-only renderer_config from frontmatter", () => {
    const markdown = `---
renderer_config:
  presetName: Daily Challenge
---

# Test Note
`;

    const grouped = readGroupedNoteConfig(markdown);

    expect(grouped).toEqual({
      presetName: "Daily Challenge",
    });
  });

  it("does not rewrite malformed frontmatter when saving renderer_config", () => {
    const markdown = `---
title: Test
broken: [oops
---

# Test Note

## 正文

hello
`;

    const updated = writeGroupedNoteConfig(markdown, {
      theme: "mist",
      fontSize: 30,
    });

    expect(updated).toBe(markdown);
    expect(updated).not.toContain("renderer_config:");
  });
});
