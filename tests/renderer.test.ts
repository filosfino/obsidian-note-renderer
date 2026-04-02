import { describe, expect, it } from "vitest";
import { Component } from "obsidian";
import { renderNote } from "../src/renderer";
import { RENDER_DEFAULTS } from "../src/schema";
import { PAGE_HEIGHTS, getPageWidth } from "../src/constants";

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
      getFirstLinkpathDest(name: string, sourcePath: string) {
        const scoped = sourcePath ? `${sourcePath}::${name}` : name;
        const path = validImages[scoped] ? scoped : (validImages[name] ? name : null);
        if (!path) return null;
        return { path };
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

  it("keeps page padding on cover text by default", async () => {
    const rendered = await renderNote(
      createMockApp() as never,
      "# 封面标题",
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      RENDER_DEFAULTS,
    );

    const inlineStyle = rendered.pages[0].querySelector("style")?.textContent || "";
    expect(inlineStyle).toContain(".nr-page-cover {\n  padding-left: 40px;\n  padding-right: 40px;\n}");

    rendered.cleanup();
  });

  it("can set cover page padding to zero and use the full cover width", async () => {
    const rendered = await renderNote(
      createMockApp() as never,
      "# 封面标题",
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverPagePaddingX: 0,
      },
    );

    const inlineStyle = rendered.pages[0].querySelector("style")?.textContent || "";
    expect(inlineStyle).toContain(".nr-page-cover {\n  padding-left: 0px;\n  padding-right: 0px;\n}");

    rendered.cleanup();
  });

  it("uses custom cover page padding in px", async () => {
    const rendered = await renderNote(
      createMockApp() as never,
      "# 封面标题",
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverPagePaddingX: 40,
      },
    );

    const inlineStyle = rendered.pages[0].querySelector("style")?.textContent || "";
    expect(inlineStyle).toContain(".nr-page-cover {\n  padding-left: 40px;\n  padding-right: 40px;\n}");

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

  it("treats outer double-stroke width as extra thickness beyond the inner stroke", async () => {
    const markdown = `
## 标题

双描边
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
        coverStrokeStyle: "double",
        coverStrokePercent: 4,
        coverDoubleStrokePercent: 0,
      },
    );

    const extraRendered = await renderNote(
      createMockApp() as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverStrokeStyle: "double",
        coverStrokePercent: 4,
        coverDoubleStrokePercent: 6,
      },
    );

    const baseWrap = baseRendered.pages[0].querySelector(".nr-double-stroke-wrap") as HTMLElement | null;
    const extraWrap = extraRendered.pages[0].querySelector(".nr-double-stroke-wrap") as HTMLElement | null;
    const baseClone = baseWrap?.firstElementChild as HTMLElement | null;
    const extraClone = extraWrap?.firstElementChild as HTMLElement | null;

    expect(baseClone).not.toBeNull();
    expect(extraClone).not.toBeNull();
    const baseRadius = Number(baseClone?.dataset.doubleStrokeRadius || "0");
    const extraRadius = Number(extraClone?.dataset.doubleStrokeRadius || "0");

    expect(baseRadius).toBeGreaterThan(0);
    expect(extraRadius).toBeGreaterThan(baseRadius);

    baseRendered.cleanup();
    extraRendered.cleanup();
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

  it("resolves vault images relative to the current source note path", async () => {
    const markdown = `
## 标题

相对图片

## 封面图

![[hero.png]]

## 正文

![[body.png]]
`;

    const rendered = await renderNote(
      createMockApp({
        "folder/note.md::hero.png": "app://scoped-cover.png",
        "folder/note.md::body.png": "app://scoped-body.png",
        "hero.png": "app://fallback-cover.png",
        "body.png": "app://fallback-body.png",
      }) as never,
      markdown,
      "folder/note.md",
      ".theme {}",
      "cream",
      new Component(),
      RENDER_DEFAULTS,
    );

    expect(rendered.pages[0].querySelector(".nr-cover-bg-image")?.getAttribute("src")).toBe("app://scoped-cover.png");
    expect(rendered.pages[1].querySelector("img")?.getAttribute("src")).toBe("app://scoped-body.png");
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

  it("constrains embedded cover text images instead of auto-scaling them like text", async () => {
    const markdown = `
## 标题

封面标题

## 封面文字

![[logo.png]]
`;

    const rendered = await renderNote(
      createMockApp({ "logo.png": "app://logo.png" }) as never,
      markdown,
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      RENDER_DEFAULTS,
    );

    const imageBlock = rendered.pages[0].querySelector(".nr-cover-content p") as HTMLElement | null;
    const image = rendered.pages[0].querySelector(".nr-cover-content img") as HTMLElement | null;

    expect(imageBlock).not.toBeNull();
    expect(image).not.toBeNull();
    expect(imageBlock?.style.fontSize).toBe("0px");
    expect(imageBlock?.style.lineHeight).toBe("0");
    expect(image?.style.maxWidth).toBe("100%");
    expect(image?.style.objectFit).toBe("contain");

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

  it("lets some network nodes spill outside the canvas for softer edge connections", async () => {
    const rendered = await renderNote(
      createMockApp() as never,
      "# Title",
      "test.md",
      ".theme {}",
      "cream",
      new Component(),
      {
        ...RENDER_DEFAULTS,
        coverEffects: {
          ...RENDER_DEFAULTS.coverEffects,
          network: { enabled: true, opacity: 15, count: 8, width: 2 },
        },
      },
    );

    const circles = Array.from(rendered.pages[0].querySelectorAll(".nr-effect-overlay circle"));
    const hasOutsideNode = circles.some((circle) => {
      const cx = Number(circle.getAttribute("cx"));
      const cy = Number(circle.getAttribute("cy"));
      return cx < 0 || cx > getPageWidth("card") || cy < 0 || cy > PAGE_HEIGHTS.card;
    });

    expect(hasOutsideNode).toBe(true);

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

    const lines = Array.from(rendered.pages[0].querySelectorAll(".nr-effect-overlay line"));
    const verticalLines = lines.filter((line) => line.getAttribute("x1") === line.getAttribute("x2"));
    const horizontalLines = lines.filter((line) => line.getAttribute("y1") === line.getAttribute("y2"));

    expect(verticalLines[0]?.getAttribute("x1")).toBe("6");
    expect(verticalLines[1]?.getAttribute("x1")).toBe("90");
    expect(horizontalLines[0]?.getAttribute("y1")).toBe("22");
    expect(horizontalLines[1]?.getAttribute("y1")).toBe("106");

    rendered.cleanup();
  });
});
