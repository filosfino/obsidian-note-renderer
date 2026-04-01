import { marked } from "marked";
import { App } from "obsidian";

const markExtension = {
  name: "mark",
  level: "inline",
  start(src: string) {
    return src.indexOf("==");
  },
  tokenizer(this: { lexer: { inlineTokens(src: string): unknown[] } }, src: string) {
    const match = /^==(?=\S)([\s\S]*?\S)==/.exec(src);
    if (!match) return undefined;
    return {
      type: "mark",
      raw: match[0],
      text: match[1],
      tokens: this.lexer.inlineTokens(match[1]),
    };
  },
  renderer(this: { parser: { parseInline(tokens: unknown[]): string } }, token: { tokens?: unknown[] }) {
    return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`;
  },
};

marked.use({
  extensions: [markExtension as never],
});

/**
 * Shared markdown→HTML conversion, used by both the Obsidian plugin and the CLI preview tool.
 * Uses `marked` as the single rendering engine to ensure identical output.
 *
 * Handles Obsidian-specific syntax:
 * - ![[image.ext]] → <img> with resolved vault path
 * - [[wikilink]] → plain text (not rendered as link in images)
 */
export function renderMarkdownToHtml(
  markdown: string,
  resolveImage?: (name: string) => string
): string {
  // Pre-process: convert Obsidian image embeds to standard markdown
  // and ensure images are on their own line (so marked renders them
  // as separate <p> blocks, enabling proper pagination)
  let processed = markdown.replace(/!\[\[([^\]]+)\]\]/g, (_, raw) => {
    // Parse optional size: ![[image.png|500]] or ![[image.png|500x300]]
    const pipeIndex = raw.lastIndexOf("|");
    let name = raw;
    let sizeAttr = "";
    let isFullPage = false;
    let fullPageFit: "contain" | "cover" = "contain";
    if (pipeIndex !== -1) {
      const sizePart = raw.slice(pipeIndex + 1).trim();
      if (sizePart === "full" || sizePart === "contain") {
        name = raw.slice(0, pipeIndex).trim();
        isFullPage = true;
        fullPageFit = "contain";
      } else if (sizePart === "cover") {
        name = raw.slice(0, pipeIndex).trim();
        isFullPage = true;
        fullPageFit = "cover";
      } else {
        const sizeMatch = sizePart.match(/^(\d+)(?:x(\d+))?$/);
        if (sizeMatch) {
          name = raw.slice(0, pipeIndex).trim();
          sizeAttr = ` width="${sizeMatch[1]}"`;
          if (sizeMatch[2]) {
            sizeAttr += ` height="${sizeMatch[2]}"`;
          }
        }
      }
    }
    const src = resolveImage ? resolveImage(name) : name;
    if (isFullPage) {
      const fitClass = fullPageFit === "cover" ? "nr-full-page nr-full-cover" : "nr-full-page";
      return `\n\n<img src="${src}" alt="${name}" class="${fitClass}">\n\n`;
    }
    if (sizeAttr) {
      return `\n\n<img src="${src}" alt="${name}"${sizeAttr}>\n\n`;
    }
    return `\n\n![${name}](${src})\n\n`;
  });

  // Also split standard markdown images that are inline with text
  processed = processed.replace(/([^\n])(!\[[^\]]*\]\([^)]+\))/g, "$1\n\n$2");
  processed = processed.replace(/(!\[[^\]]*\]\([^)]+\))([^\n])/g, "$1\n\n$2");

  // Pre-process: strip wikilinks to plain text (we don't need links in rendered images)
  processed = processed.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2"); // [[target|alias]] → alias
  processed = processed.replace(/\[\[([^\]]+)\]\]/g, "$1"); // [[target]] → target

  return marked.parse(processed, { breaks: false, gfm: true }) as string;
}

/**
 * Create an image resolver for an Obsidian vault.
 * Resolves image names to app:// URIs that work in Obsidian's webview.
 */
export function createVaultImageResolver(app: App): (name: string, sourcePath?: string) => string {
  return (name: string, sourcePath = "") => {
    const file = app.metadataCache.getFirstLinkpathDest(name, sourcePath);
    if (file) {
      return app.vault.getResourcePath(file);
    }
    return name;
  };
}
