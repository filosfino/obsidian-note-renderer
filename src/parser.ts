/**
 * Parse XHS note markdown into structured sections based on H2 headings.
 *
 * Renderer reads these finalized sections:
 * - ## 标题        → cover title text
 * - ## 封面        → cover page content (markdown, supports multi-line)
 * - ## 正文        → body content (auto-paginated)
 *
 * Fallback chain for cover:
 * 1. ## 封面 exists      → render its content as cover page
 * 2. ## 标题 exists      → render as centered title
 * 3. ## 标题备选 exists   → pick marked or first candidate
 * 4. H1                  → use as title
 */

export interface NoteStructure {
  title: string;
  coverMarkdown: string | null; // null = no ## 封面, use title-only cover
  bodyMarkdown: string;
}

interface Section {
  heading: string;
  content: string;
}

export function parseNoteStructure(markdown: string): NoteStructure {
  const stripped = stripFrontmatter(markdown);
  const sections = splitH2Sections(stripped);

  const titleSection = sections.find((s) => s.heading === "标题");
  const titleAltSection = sections.find((s) => s.heading === "标题备选");
  const coverSection = sections.find((s) => s.heading === "封面");
  const bodySection = sections.find((s) => s.heading === "正文");

  // Has H2 structure
  if (titleSection || titleAltSection || bodySection) {
    const title = titleSection
      ? titleSection.content.trim().split("\n").filter((l) => l.trim())[0]?.trim() || ""
      : titleAltSection
        ? extractFromAltTitles(titleAltSection)
        : extractH1(stripped);

    return {
      title,
      coverMarkdown: coverSection ? coverSection.content.trim() : null,
      bodyMarkdown: bodySection ? bodySection.content.trim() : "",
    };
  }

  // Fallback: old format (H1 + body)
  return fallbackParse(stripped);
}

function stripFrontmatter(md: string): string {
  const match = md.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? md.slice(match[0].length) : md;
}

function splitH2Sections(md: string): Section[] {
  const sections: Section[] = [];
  const h2Regex = /^## (.+)$/gm;
  const matches: { heading: string; index: number; fullMatch: string }[] = [];

  let m;
  while ((m = h2Regex.exec(md)) !== null) {
    matches.push({ heading: m[1].trim(), index: m.index, fullMatch: m[0] });
  }

  for (let i = 0; i < matches.length; i++) {
    const contentStart = matches[i].index + matches[i].fullMatch.length;
    const contentEnd = i + 1 < matches.length ? matches[i + 1].index : md.length;
    sections.push({
      heading: matches[i].heading,
      content: md.slice(contentStart, contentEnd),
    });
  }

  return sections;
}

function extractFromAltTitles(section: Section): string {
  const lines = section.content.trim().split("\n").filter((l) => l.trim());

  // Look for ← 最终选用
  const selected = lines.find(
    (l) => l.includes("← 最终选用") || l.includes("←最终选用")
  );
  if (selected) {
    return cleanTitleLine(selected);
  }

  // Fallback: first non-header table row
  for (const line of lines) {
    if (line.startsWith("|") && !line.includes("---") && !line.includes("标题")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        return cleanTitleLine(cells[1]);
      }
    }
  }

  // Last resort: first non-empty line
  return lines.length > 0 ? cleanTitleLine(lines[0]) : "";
}

function cleanTitleLine(line: string): string {
  return line
    .replace(/^[\d.)\-*|]+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/←.*$/, "")
    .replace(/\|/g, "")
    .trim();
}

function extractH1(md: string): string {
  const match = md.match(/^# (.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function fallbackParse(md: string): NoteStructure {
  const h1Match = md.match(/^# (.+)$/m);
  if (!h1Match) {
    return { title: "Untitled", coverMarkdown: null, bodyMarkdown: md.trim() };
  }

  const title = h1Match[1].trim();
  const afterH1 = md.slice(h1Match.index! + h1Match[0].length);
  const h2Start = afterH1.search(/^## /m);
  const body = h2Start >= 0 ? afterH1.slice(0, h2Start) : afterH1;

  return { title, coverMarkdown: null, bodyMarkdown: body.trim() };
}
