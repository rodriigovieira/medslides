import type { Slide } from "./deck";

/**
 * Deterministic type-fitting.
 *
 * Sizes used to be fixed `cqw` constants, so a slide with five bullets that
 * each wrapped to two lines simply ran off the bottom edge and collided with
 * the reference strip. Nothing measured anything, so nothing could push back.
 *
 * This estimates how many lines the content will occupy at a candidate size
 * and shrinks the scale until it fits the available box. It is an estimate, not
 * a measurement — but it runs identically in the browser, in a thumbnail, and
 * in the PowerPoint exporter, which a DOM measurement could not.
 */

/** Slide geometry, in `cqw` (the slide is 100 wide × 56.25 tall). */
export const SLIDE_H = 56.25;
const PAD_X = 7;
const PAD_TOP = 6.5;
const PAD_BOTTOM = 6.5;

/** Average glyph advance as a fraction of font size, for Latin text. */
const CHAR_RATIO = 0.5;

export type FitInput = {
  slide: Slide;
  /** True when a photo panel occupies the right side. */
  panel: boolean;
  /** True when the slide shows a citation strip. */
  hasRefs: boolean;
};

export type Fit = {
  /** Multiplier applied to every type size on the slide. */
  scale: number;
  /** Vertical space the footer needs, in cqw. */
  footer: number;
};

function contentWidth(panel: boolean): number {
  return panel ? 100 - PAD_X - 46 : 100 - PAD_X * 2;
}

/** Lines a string occupies at a given size within a width. */
function lineCount(text: string, size: number, width: number): number {
  const perLine = Math.max(8, Math.floor(width / (size * CHAR_RATIO)));
  return Math.max(1, Math.ceil(text.length / perLine));
}

/**
 * Height of the slide body at `scale`, in cqw. Mirrors the renderer's own
 * sizes; when you change a size in SlideView, change it here too.
 */
function bodyHeight(input: FitInput, scale: number): number {
  const { slide, panel } = input;
  const width = contentWidth(panel);

  const titleSize = 4.2 * scale;
  const bulletSize = 2.3 * scale;
  const columnSize = 1.95 * scale;

  let height = 0;

  // Title + optional subtitle, then the gap before the body.
  height += lineCount(slide.title, titleSize, width) * titleSize * 1.12;
  if (slide.subtitle) {
    height += 1.3 * scale + lineCount(slide.subtitle, 2 * scale, width) * 2 * scale * 1.2;
  }
  height += 3.4 * scale;

  if (slide.layout === "comparacao") {
    const columns = [slide.left, slide.right].filter(Boolean);
    const columnWidth = (width - 4.5) / 2;
    const tallest = Math.max(
      0,
      ...columns.map((col) => {
        if (!col) return 0;
        const heading =
          lineCount(col.heading, 2.3 * scale, columnWidth) * 2.3 * scale * 1.2;
        const items = col.bullets.reduce(
          (sum, b) =>
            sum +
            lineCount(b, columnSize, columnWidth) * columnSize * 1.25 +
            1.3 * scale,
          0,
        );
        return heading + 1.8 * scale + items;
      }),
    );
    return height + tallest;
  }

  const bullets = slide.bullets ?? [];
  // The bullet marker and its gap eat into the text column.
  const bulletWidth = width - 2.5;
  height += bullets.reduce(
    (sum, b) =>
      sum + lineCount(b, bulletSize, bulletWidth) * bulletSize * 1.25 + 1.9 * scale,
    0,
  );

  return height;
}

export function fitSlide(input: FitInput): Fit {
  // The citation strip is real content, not decoration — reserve its height so
  // body text can never flow underneath it.
  const footer = input.hasRefs ? 5.4 : 2.6;
  const available = SLIDE_H - PAD_TOP - PAD_BOTTOM - footer;

  // Layouts whose size is driven by their own geometry rather than text flow.
  if (
    input.slide.layout === "capa" ||
    input.slide.layout === "secao" ||
    input.slide.layout === "destaque" ||
    input.slide.nodes
  ) {
    return { scale: 1, footer };
  }

  let scale = 1;
  // Shrink in small steps; below ~0.74 the type stops being projector-legible,
  // and the right fix at that point is less text, not smaller text.
  while (scale > 0.74 && bodyHeight(input, scale) > available) {
    scale -= 0.02;
  }
  return { scale: Math.round(scale * 100) / 100, footer };
}

/** `cqw` size string for a base size at the fitted scale. */
export function sized(base: number, scale: number): string {
  return `${(base * scale).toFixed(2)}cqw`;
}
