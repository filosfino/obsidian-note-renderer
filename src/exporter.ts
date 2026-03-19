import { toBlob } from "html-to-image";
import JSZip from "jszip";

/**
 * Export page elements as PNG images packed into a zip file.
 *
 * Each page element must be attached to the DOM (can be offscreen)
 * at its full 1080×1440 resolution for accurate capture.
 */
export async function exportPages(
  pages: HTMLElement[],
  filename: string
): Promise<Blob> {
  const zip = new JSZip();

  // Mount pages offscreen for rendering
  const offscreen = document.createElement("div");
  offscreen.style.cssText = "position: fixed; left: -9999px; top: 0;";
  document.body.appendChild(offscreen);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i].cloneNode(true) as HTMLElement;
    offscreen.appendChild(page);

    const blob = await toBlob(page, {
      width: 1080,
      height: 1440,
      pixelRatio: 1,
      cacheBust: true,
    });

    if (blob) {
      const pageNum = String(i + 1).padStart(2, "0");
      zip.file(`${filename}_${pageNum}.png`, blob);
    }

    page.remove();
  }

  offscreen.remove();
  return zip.generateAsync({ type: "blob" });
}
