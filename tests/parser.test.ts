import { describe, expect, it } from "vitest";
import { parseNoteStructure, parseRendererConfig } from "../src/parser";

describe("parser fenced code handling", () => {
  it("ignores H2 headings inside fenced code blocks when splitting note structure", () => {
    const markdown = `
## 标题

真实标题

## 正文

\`\`\`md
## 这不是一个真正的章节
内容仍属于正文
\`\`\`

正文结尾
`;

    const structure = parseNoteStructure(markdown);

    expect(structure.title).toBe("真实标题");
    expect(structure.bodyMarkdown).toContain("## 这不是一个真正的章节");
    expect(structure.bodyMarkdown).toContain("正文结尾");
  });

  it("ignores fenced fake renderer_config headings while reading the real config section", () => {
    const markdown = `
## 正文

\`\`\`md
## renderer_config
theme: graphite
\`\`\`

## renderer_config

\`\`\`yaml
theme: mist
\`\`\`
`;

    const config = parseRendererConfig(markdown);

    expect(config).toMatchObject({ activeTheme: "mist" });
  });
});
