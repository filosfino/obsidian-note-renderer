import { toBlob } from "html-to-image";
import JSZip from "jszip";

/**
 * Export page elements as PNG images packed into a zip file.
 *
 * Each page element must be attached to the DOM (can be offscreen)
 * at its full resolution for accurate capture. The height is read
 * from each page's inline style to support both 3:5 and 3:4 modes.
 */
/**
 * Export a single page element as a PNG blob (no zip).
 */
export async function exportSinglePage(
  page: HTMLElement,
  _filename: string
): Promise<Blob> {
  const offscreen = document.createElement("div");
  offscreen.classList.add("nr-offscreen");
  document.body.appendChild(offscreen);

  const clone = page.cloneNode(true) as HTMLElement;
  clone.classList.add("nr-export-page");
  offscreen.appendChild(clone);

  const pageWidth = parseInt(clone.style.width) || 1080;
  const pageHeight = parseInt(clone.style.height) || 1800;

  const blob = await toBlob(clone, {
    width: pageWidth,
    height: pageHeight,
    pixelRatio: 2,
    cacheBust: true,
  });

  clone.remove();
  offscreen.remove();

  if (!blob) throw new Error("Failed to render page");
  return blob;
}

/**
 * Scale a PNG blob by the given factor (0-1).
 * Uses an offscreen canvas to resize the image.
 */
export async function scaleBlob(blob: Blob, scale: number): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(blob);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for scaling"));
      img.src = url;
    });

    const newWidth = Math.round(img.naturalWidth * scale);
    const newHeight = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Failed to export scaled image"));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportPages(
  pages: HTMLElement[],
  filename: string
): Promise<Blob> {
  const zip = new JSZip();

  // Mount pages offscreen for rendering
  const offscreen = document.createElement("div");
  offscreen.classList.add("nr-offscreen");
  document.body.appendChild(offscreen);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i].cloneNode(true) as HTMLElement;
    page.classList.add("nr-export-page");
    offscreen.appendChild(page);

    // Read actual dimensions from the page's inline style
    const pageWidth = parseInt(page.style.width) || 1080;
    const pageHeight = parseInt(page.style.height) || 1800;

    const blob = await toBlob(page, {
      width: pageWidth,
      height: pageHeight,
      pixelRatio: 2,
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
