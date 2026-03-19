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
  let processed = markdown.replace(/!\[\[([^\]]+)\]\]/g, (_, name) => {
    const src = resolveImage ? resolveImage(name) : name;
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
