import { marked } from "marked";
import { App } from "obsidian";

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
    if (pipeIndex !== -1) {
      const sizePart = raw.slice(pipeIndex + 1).trim();
      if (sizePart === "full") {
        name = raw.slice(0, pipeIndex).trim();
        isFullPage = true;
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
      return `\n\n<img src="${src}" alt="${name}" class="nr-full-page">\n\n`;
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
export function createVaultImageResolver(app: App): (name: string) => string {
  return (name: string) => {
    const file = app.metadataCache.getFirstLinkpathDest(name, "");
    if (file) {
      return app.vault.getResourcePath(file);
    }
    return name;
  };
}
