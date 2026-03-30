import { describe, expect, it } from "vitest";
import { Component } from "obsidian";
import { renderNote } from "../src/renderer";
import { RENDER_DEFAULTS } from "../src/schema";

function extractUnderlineStrokeWidth(backgroundImage: string): number {
  const decoded = decodeURIComponent(backgroundImage);
  const match = decoded.match(/stroke-width="([^"]+)"/);
  return match ? Number(match[1]) : 0;
}

function extractUnderlineWaveHeight(backgroundSize: string): number {
  const match = backgroundSize.match(/200px (\d+)px/);
  return match ? Number(match[1]) : 0;
}

function extractUnderlinePaddingBottom(paddingBottom: string): number {
  return Number.parseInt(paddingBottom || "0", 10);
}

function createMockApp(validImages: Record<string, string> = {}) {
  return {
    metadataCache: {
      getFirstLinkpathDest(name: string) {
        if (!validImages[name]) return null;
        return { path: name };
      },
    },
    vault: {
      getResourcePath(file: { path: string }) {
        return validImages[file.path];
      },
    },
  };
}

function extractBokehAlphas(styleText: string): number[] {
  return Array.from(styleText.matchAll(/rgba\(\d+,\d+,\d+,([0-9.]+)\)/g)).map((match) => Number(match[1]));
}

describe("renderNote", () => {
  it("shows cover image and keeps overlay available only for valid image embeds", async () => {
    const markdown = `
## 标题

封面标题

## 封面图

![cover](app://cover.png)

## 正文

正文
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      RENDER_DEFAULTS,
    );

    expect(rendered.hasCoverImage).toBe(true);
    expect(rendered.pages).toHaveLength(2);
    expect(rendered.pages[0].classList.contains("nr-cover-has-image")).toBe(true);
    expect(rendered.pages[0].querySelector(".nr-cover-bg-image")?.getAttribute("src")).toBe("app://cover.png");
    rendered.cleanup();
  });

  it("treats invalid cover image content as no cover image and skips overlay background", async () => {
    const markdown = `
## 标题

封面标题

## 封面图

这里没有图片

## 正文

正文
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      RENDER_DEFAULTS,
    );

    expect(rendered.hasCoverImage).toBe(false);
    expect(rendered.pages).toHaveLength(2);
    expect(rendered.pages[0].querySelector(".nr-cover-bg-image")).toBeNull();
    expect(rendered.pages[0].querySelector(".nr-cover-content")?.getAttribute("style") || "").not.toContain("linear-gradient");
    rendered.cleanup();
  });

  it("removes overlay background when overlay effect is disabled", async () => {
    const markdown = `
## 标题

封面标题

## 封面图

![cover](app://cover.png)

## 正文

正文
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          overlay: { enabled: false, opacity: 55 },
        },
      },
    );

    expect(rendered.pages[0].querySelector(".nr-cover-content")?.getAttribute("style") || "").toContain("background: none");
    rendered.cleanup();
  });

  it("renders bokeh with lighter center and stronger edge highlights", async () => {
    const markdown = `
# Title
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          bokeh: { enabled: true, opacity: 20, count: 8 },
        },
      },
    );

    const overlay = rendered.pages[0].querySelector(".nr-effect-overlay > div");
    const boxShadow = overlay?.getAttribute("style") || "";
    const alphas = extractBokehAlphas(boxShadow);

    expect(boxShadow).toContain("box-shadow");
    expect(alphas).toHaveLength(8);
    expect(Math.min(...alphas)).toBeLessThan(0.2);
    expect(Math.max(...alphas)).toBeGreaterThan(0.7);
    rendered.cleanup();
  });

  it("applies custom color to the bokeh effect", async () => {
    const markdown = `
# Title
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          bokeh: { enabled: true, opacity: 20, count: 8, color: "#ff6600" },
        },
      },
    );

    const overlay = rendered.pages[0].querySelector(".nr-effect-overlay > div");
    const boxShadow = overlay?.getAttribute("style") || "";
    expect(boxShadow).toContain("rgba(255,102,0,");
    rendered.cleanup();
  });

  it("renders dotted notebook-style decoration with configurable spacing", async () => {
    const markdown = `
# Title
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "mist",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          dots: { enabled: true, opacity: 18, spacing: 32, size: 6, color: "#6f8aa5" },
        },
      },
    );

    const overlayStyle = rendered.pages[0].querySelector(".nr-effect-overlay")?.getAttribute("style") || "";
    expect(overlayStyle).toContain("radial-gradient");
    expect(overlayStyle).toContain("32px 32px");
    expect(overlayStyle).toContain("6px");
    expect(overlayStyle.replaceAll(" ", "")).toContain("rgba(111,138,165,");
    rendered.cleanup();
  });

  it("keeps cover text above decorative effect overlays", async () => {
    const markdown = `
## 标题

9套
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "mist",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          bokeh: { enabled: true, opacity: 20, count: 12 },
        },
      },
    );

    const inlineStyle = rendered.pages[0].querySelector("style")?.textContent || "";
    expect(inlineStyle).toContain(".nr-page-cover .nr-cover-content {\n  position: relative;\n  z-index: 3;");
    expect(rendered.pages[0].querySelector(".nr-effect-overlay")).not.toBeNull();

    rendered.cleanup();
  });

  it("wraps title text with a double-stroke backdrop in double mode", async () => {
    const markdown = `
## 标题

双描边
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverStrokeStyle: "double",
      },
    );

    expect(rendered.pages[0].querySelector(".nr-double-stroke-wrap")).not.toBeNull();
    rendered.cleanup();
  });

  it("splits body pages at manual separators", async () => {
    const markdown = `
## 标题

分页测试

## 正文

<div data-test-height="500">第一页</div>

---

<div data-test-height="500">第二页</div>
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      RENDER_DEFAULTS,
    );

    expect(rendered.pages).toHaveLength(3);
    expect(rendered.pages[1].querySelector(".nr-page-content")?.textContent).toContain("第一页");
    expect(rendered.pages[2].querySelector(".nr-page-content")?.textContent).toContain("第二页");
    rendered.cleanup();
  });

  it("renders full-page body images as standalone full pages", async () => {
    const markdown = `
## 标题

整页图

## 正文

![[hero.png|cover]]
`;

    const rendered = await renderNote(
      createMockApp({ "hero.png": "app://hero.png" }) as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      RENDER_DEFAULTS,
    );

    expect(rendered.pages).toHaveLength(2);
    expect(rendered.pages[1].classList.contains("nr-page-full")).toBe(true);
    expect(rendered.pages[1].querySelector("img.nr-full-page-img")?.getAttribute("src")).toBe("app://hero.png");
    rendered.cleanup();
  });

  it("uses banner horizontal padding as a percentage of the font size", async () => {
    const markdown = `
## 标题

色带宽度
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverBanner: true,
        coverBannerPaddingPercent: 60,
      },
    );

    const titleStyle = rendered.pages[0].querySelector(".nr-cover-content h1")?.getAttribute("style") || "";
    expect(titleStyle).toContain("padding: 8px");
    expect(titleStyle).toMatch(/padding:\s*8px\s+\d+px/);
    rendered.cleanup();
  });

  it("does not apply banner styling to image blocks inside cover markdown", async () => {
    const markdown = `
## 封面文字

![cover](app://inline-cover.png)

一行文字
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverBanner: true,
        coverBannerPaddingPercent: 60,
      },
    );

    const coverElements = Array.from(rendered.pages[0].querySelectorAll(".nr-cover-content p, .nr-cover-content h1, .nr-cover-content h2, .nr-cover-content h3, .nr-cover-content div"));
    const imageParagraphStyle = coverElements.find((el) => el.querySelector("img"))?.getAttribute("style") || "";

    expect(imageParagraphStyle).not.toContain("background:");
    expect(imageParagraphStyle).not.toContain("padding:");
    rendered.cleanup();
  });

  it("scales underline wave thickness with the rendered cover font size", async () => {
    const markdown = `
## 标题

下划线测试

## 封面文字

<u>很大的下划线</u>
`;

    const normalRendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverFontScale: 100,
      },
    );

    const scaledRendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverFontScale: 200,
      },
    );

    const normalUnderline = normalRendered.pages[0].querySelector(".nr-cover-content u") as HTMLElement | null;
    const scaledUnderline = scaledRendered.pages[0].querySelector(".nr-cover-content u") as HTMLElement | null;

    expect(normalUnderline).not.toBeNull();
    expect(scaledUnderline).not.toBeNull();
    expect(extractUnderlineStrokeWidth(scaledUnderline?.style.backgroundImage || "")).toBeGreaterThan(
      extractUnderlineStrokeWidth(normalUnderline?.style.backgroundImage || ""),
    );
    expect(extractUnderlineWaveHeight(scaledUnderline?.style.backgroundSize || "")).toBeGreaterThan(
      extractUnderlineWaveHeight(normalUnderline?.style.backgroundSize || ""),
    );
    expect(extractUnderlinePaddingBottom(scaledUnderline?.style.paddingBottom || "")).toBeGreaterThan(
      extractUnderlinePaddingBottom(normalUnderline?.style.paddingBottom || ""),
    );

    normalRendered.cleanup();
    scaledRendered.cleanup();
  });

  it("applies cover text opacity to rendered cover elements", async () => {
    const rendered = await renderNote(
      createMockApp() as never,
      "# 标题",
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverFontOpacity: 40,
      },
    );

    const title = rendered.pages[0].querySelector(".nr-cover-content h1") as HTMLElement | null;

    expect(title).not.toBeNull();
    expect(title?.style.opacity).toBe("0.4");

    rendered.cleanup();
  });


  it("applies configurable width as an overall network scale", async () => {
    const markdown = `
# Title
`;

    const baseRendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          network: { enabled: true, opacity: 15, count: 8, width: 1 },
        },
      },
    );

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          network: { enabled: true, opacity: 15, count: 8, width: 3 },
        },
      },
    );

    const baseLine = baseRendered.pages[0].querySelector(".nr-effect-overlay line");
    const baseCircle = baseRendered.pages[0].querySelector(".nr-effect-overlay circle");
    const line = rendered.pages[0].querySelector(".nr-effect-overlay line");
    const circle = rendered.pages[0].querySelector(".nr-effect-overlay circle");
    expect(baseLine?.getAttribute("stroke-width")).toBe("1");
    expect(line?.getAttribute("stroke-width")).toBe("3");
    expect(Number(circle?.getAttribute("r"))).toBeGreaterThan(Number(baseCircle?.getAttribute("r")));
    baseRendered.cleanup();
    rendered.cleanup();
  });

  it("adapts grain blend mode for light and dark themes", async () => {
    const markdown = `
# Title
`;

    const lightRendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".nr-page { background: #ffffff; color: #1a1a1a; }",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          grain: { enabled: true, opacity: 20 },
        },
      },
    );

    const darkRendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".nr-page { background: #101010; color: #f1f1f1; }",
      "graphite",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          grain: { enabled: true, opacity: 20 },
        },
      },
    );

    const lightOverlayStyle = lightRendered.pages[0].querySelector(".nr-effect-overlay")?.getAttribute("style") || "";
    const darkOverlayStyle = darkRendered.pages[0].querySelector(".nr-effect-overlay")?.getAttribute("style") || "";
    const darkRect = darkRendered.pages[0].querySelector(".nr-effect-overlay rect");

    expect(lightOverlayStyle).toContain("mix-blend-mode: multiply");
    expect(darkOverlayStyle).toContain("mix-blend-mode: screen");
    expect(darkRect?.getAttribute("fill")).toBe("white");

    lightRendered.cleanup();
    darkRendered.cleanup();
  });

  it("applies configurable spacing to the grid effect", async () => {
    const markdown = `
# Title
`;

    const rendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          grid: { enabled: true, opacity: 20, spacing: 84 },
        },
      },
    );

    const overlayStyle = rendered.pages[0].querySelector(".nr-effect-overlay")?.getAttribute("style") || "";
    expect(overlayStyle).toContain("transparent 84px");

    rendered.cleanup();
  });
});
