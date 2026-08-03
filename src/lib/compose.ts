import type { Slide } from "./deck";

export type Treatment = "full" | "panel" | "none";

/** Mirrors `imageTreatment` in SlideView so the export matches the preview. */
export function treatmentFor(slide: Slide, hasImage: boolean): Treatment {
  if (!hasImage) return "none";
  if (slide.layout === "capa" || slide.layout === "secao") return "full";
  if (slide.layout === "destaque") return "full";
  if (slide.layout === "comparacao") return "none";
  return "panel";
}

const OUT_W = 1920;
const OUT_H = 1080;
const PAPER = "#fffefb";

/**
 * Loads through a blob URL rather than setting the remote src directly: it
 * avoids tainting the canvas, so `toDataURL` works regardless of the storage
 * host's CORS headers.
 */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blobUrl = URL.createObjectURL(await res.blob());
    try {
      return await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = blobUrl;
      });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    return null;
  }
}

/** `object-fit: cover` for canvas. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/**
 * Flattens the photo and its scrim into a single full-bleed image.
 *
 * The previous export layered a semi-transparent shape over the photo in
 * PowerPoint. PowerPoint honours `<a:alpha>`, but lightweight viewers — iOS
 * Quick Look, the WhatsApp preview — ignore it and paint the shape SOLID,
 * burying the photo and leaving text on a flat slab. Baking the gradient into
 * the pixels removes that whole class of failure: every viewer just draws a
 * picture.
 */
export async function composeSlideImage(
  url: string,
  slide: Slide,
  treatment: Treatment,
): Promise<string | null> {
  if (treatment === "none") return null;
  const img = await loadImage(url);
  if (!img) return null;

  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (treatment === "full") {
    drawCover(ctx, img, 0, 0, OUT_W, OUT_H);

    const gradient =
      slide.layout === "capa"
        ? ctx.createLinearGradient(0, OUT_H, 0, 0)
        : ctx.createLinearGradient(0, 0, OUT_W, 0);

    if (slide.layout === "capa") {
      gradient.addColorStop(0, "rgba(8,16,24,0.94)");
      gradient.addColorStop(0.34, "rgba(8,16,24,0.72)");
      gradient.addColorStop(0.7, "rgba(8,16,24,0.30)");
      gradient.addColorStop(1, "rgba(8,16,24,0.18)");
    } else {
      gradient.addColorStop(0, "rgba(8,16,24,0.90)");
      gradient.addColorStop(0.45, "rgba(8,16,24,0.74)");
      gradient.addColorStop(1, "rgba(8,16,24,0.44)");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, OUT_W, OUT_H);
  } else {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, OUT_W, OUT_H);

    const panelW = OUT_W * 0.41;
    const panelX = OUT_W - panelW;
    drawCover(ctx, img, panelX, 0, panelW, OUT_H);

    const featherW = OUT_W * 0.09;
    const feather = ctx.createLinearGradient(panelX, 0, panelX + featherW, 0);
    feather.addColorStop(0, PAPER);
    feather.addColorStop(0.55, "rgba(255,254,251,0.55)");
    feather.addColorStop(1, "rgba(255,254,251,0)");
    ctx.fillStyle = feather;
    ctx.fillRect(panelX, 0, featherW, OUT_H);
  }

  return canvas.toDataURL("image/jpeg", 0.86);
}
