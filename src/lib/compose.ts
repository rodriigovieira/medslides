import { DIAGRAM_LAYOUTS, type Slide, type SlideLayout } from "./deck";

export type Treatment = "full" | "panel" | "panelLeft" | "centre" | "none";

/**
 * How a slide uses its photo. The single source of truth: the renderer, the
 * exporter and the fitter all read this, and a slide that looked one way on
 * screen and another in the .pptx would be a bug in whichever one disagreed.
 *
 * **Every layout can carry a photo.** `comparacao` and the diagrams used to
 * return "none" — the reasoning was sound (a photo behind a diagram competes
 * with it), but it made "coloca uma imagem no slide 4" a request the product
 * accepted, reported as done, and then silently ignored. They now take the photo
 * full-bleed under a near-flat dark scrim and switch to dark mode, the way
 * `destaque` already did: the photo is atmosphere behind the content rather than
 * beside it, and the contrast the diagram needs is preserved.
 */
export function treatmentFor(slide: Slide, hasImage: boolean): Treatment {
  if (!hasImage) return "none";
  // An explicit placement wins. It exists so one picture can be staged large and
  // centred on one slide and small at the side on the next: the motion engine
  // matches images across slides by URL, so the same file in two placements
  // reads as one object *moving* rather than two pictures being swapped.
  if (slide.imagePlacement === "centro") return "centre";
  if (slide.imagePlacement === "esquerda") return "panelLeft";
  // An illustration is drawn on white and is the point of its own frame. Under
  // the full-bleed scrim it would be a dark rectangle with a ghost in it, so it
  // always takes the panel — beside the text, on the page, as in a journal.
  if (slide.imageStyle === "ilustracao") return "panel";
  if (slide.layout === "topicos" || slide.layout === "encerramento") {
    return "panel";
  }
  return "full";
}

/** Layouts whose content covers the whole canvas, so the scrim can't fall off. */
function coversCanvas(layout: SlideLayout): boolean {
  return layout === "comparacao" || DIAGRAM_LAYOUTS.includes(layout);
}

type Stop = [at: number, color: string];

/**
 * The scrim laid over a full-bleed photo, shared by the renderer and the
 * exporter so both draw the same thing.
 *
 * A directional gradient works when the text sits on one side. Where the content
 * spans the whole slide it can't: whichever end the gradient lightens is an end
 * with text on it, so those layouts get a near-flat scrim instead — enough
 * variation to read as a photograph, not enough to cost any node its contrast.
 */
export function scrimFor(layout: SlideLayout): {
  vertical: boolean;
  stops: Stop[];
} {
  if (layout === "capa") {
    return {
      vertical: true,
      stops: [
        [0, "rgba(8,16,24,0.94)"],
        [0.34, "rgba(8,16,24,0.72)"],
        [0.7, "rgba(8,16,24,0.30)"],
        [1, "rgba(8,16,24,0.18)"],
      ],
    };
  }
  if (coversCanvas(layout)) {
    return {
      vertical: false,
      stops: [
        [0, "rgba(8,16,24,0.92)"],
        [0.5, "rgba(8,16,24,0.86)"],
        [1, "rgba(8,16,24,0.92)"],
      ],
    };
  }
  return {
    vertical: false,
    stops: [
      [0, "rgba(8,16,24,0.90)"],
      [0.45, "rgba(8,16,24,0.74)"],
      [1, "rgba(8,16,24,0.44)"],
    ],
  };
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

    const scrim = scrimFor(slide.layout);
    const gradient = scrim.vertical
      ? ctx.createLinearGradient(0, OUT_H, 0, 0)
      : ctx.createLinearGradient(0, 0, OUT_W, 0);
    for (const [at, color] of scrim.stops) gradient.addColorStop(at, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, OUT_W, OUT_H);
  } else {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, OUT_W, OUT_H);

    // `centre` is a whole-canvas placement rather than a side panel; the others
    // are the same panel on one side or the other. The .pptx has no motion, so
    // each of these exports as the still frame it is — which is exactly right:
    // the printed deck shows the picture where it ends up.
    const centre = treatment === "centre";
    const panelW = centre ? OUT_W * 0.44 : OUT_W * 0.41;
    const panelX =
      centre
        ? (OUT_W - panelW) / 2
        : treatment === "panelLeft"
          ? 0
          : OUT_W - panelW;

    if (slide.imageStyle === "ilustracao" || centre) {
      // Contain, not cover — same reason as on screen, and the paper background
      // is already painted, so the letterboxing is invisible.
      const pad = OUT_W * 0.03;
      const boxW = panelW - pad * 2;
      const boxH = OUT_H - pad * 2 - (centre ? OUT_H * 0.1 : 0);
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      // Same reason as on screen: multiply against the paper drops the JPEG's
      // white so the art doesn't sit in a visible rectangle.
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(
        img,
        panelX + pad + (boxW - dw) / 2,
        pad + (boxH - dh) / 2,
        dw,
        dh,
      );
      ctx.globalCompositeOperation = "source-over";
      return canvas.toDataURL("image/jpeg", 0.86);
    }

    drawCover(ctx, img, panelX, 0, panelW, OUT_H);

    // The feather faces the text, so it starts at whichever edge of the panel
    // the text is on.
    const featherW = OUT_W * 0.09;
    const inner = treatment === "panelLeft" ? panelW : panelX;
    const dir = treatment === "panelLeft" ? -featherW : featherW;
    const feather = ctx.createLinearGradient(inner, 0, inner + dir, 0);
    feather.addColorStop(0, PAPER);
    feather.addColorStop(0.55, "rgba(255,254,251,0.55)");
    feather.addColorStop(1, "rgba(255,254,251,0)");
    ctx.fillStyle = feather;
    ctx.fillRect(Math.min(inner, inner + dir), 0, featherW, OUT_H);
  }

  return canvas.toDataURL("image/jpeg", 0.86);
}
