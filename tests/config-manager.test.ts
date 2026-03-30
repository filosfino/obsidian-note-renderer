import { describe, expect, it } from "vitest";
import { readGroupedNoteConfig, writeGroupedNoteConfig } from "../src/config-manager";

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
});
