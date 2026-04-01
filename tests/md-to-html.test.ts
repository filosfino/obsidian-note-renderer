import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "../src/md-to-html";

describe("renderMarkdownToHtml", () => {
  it("renders ==highlight== syntax as mark tags", () => {
    const html = renderMarkdownToHtml("这是 ==高亮== 文本");

    expect(html).toContain("<mark>高亮</mark>");
  });

  it("does not treat == inside inline code as highlight syntax", () => {
    const html = renderMarkdownToHtml("`==code==`");

    expect(html).toContain("<code>==code==</code>");
    expect(html).not.toContain("<mark>");
  });
});
