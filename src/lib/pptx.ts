import type PptxGenJS from "pptxgenjs";
import { DIAGRAM_LAYOUTS, type Deck, type Slide } from "./deck";
import { composeSlideImage, treatmentFor, type Treatment } from "./compose";
import { renderDiagram } from "./pptxDiagram";

/** pptxgenjs doesn't export its slide type, so derive it from `addSlide`. */
type PptxSlide = ReturnType<InstanceType<typeof PptxGenJS>["addSlide"]>;

const INK = "0E1B2A";
const INK_SOFT = "3C4A5A";
const INK_FAINT = "7D8896";
const PAPER = "FFFEFB";
const CLINICAL = "0D7A6F";
const CLINICAL_DEEP = "085A52";
const INK_DEEP = "0A141E";
// Pre-dimmed instead of using `transparency`, which some viewers drop.
const PAPER_FAINT = "9AA6B2";
const PAPER_MUTED = "CFD6DD";
const SIGNAL = "C2603A";

// LAYOUT_16x9 is 10 x 5.625 inches.
const W = 10;
const H = 5.625;
const MARGIN = 0.7;
const CONTENT_W = W - MARGIN * 2;

function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "apresentacao"
  );
}

export async function exportPptx(deck: Deck) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = deck.title;

  // Flatten photo + scrim into one picture per slide (see compose.ts).
  const composed = await Promise.all(
    deck.slides.map((slide) =>
      slide.imageUrl
        ? composeSlideImage(
            slide.imageUrl,
            slide,
            treatmentFor(slide, true),
          )
        : Promise.resolve(null),
    ),
  );

  deck.slides.forEach((slide, index) => {
    const image = composed[index];
    const treatment = treatmentFor(slide, Boolean(image));
    const onDark = treatment === "full";
    const dark =
      onDark || slide.layout === "secao" || slide.layout === "destaque";

    const s = pptx.addSlide();
    s.background = { color: dark ? INK_DEEP : PAPER };

    if (image) {
      s.addImage({ data: image, x: 0, y: 0, w: W, h: H });
    }

    renderSlide(s, slide, dark, treatment);

    if (slide.layout !== "capa") {
      s.addShape("rect", {
        x: 0,
        y: 0,
        w: 1.5,
        h: 0.085,
        fill: { color: dark ? PAPER : CLINICAL },
        line: { type: "none" },
      });
      s.addText(`${index + 1} / ${deck.slides.length}`, {
        x: (treatment === "panel" ? W * 0.53 : W - MARGIN) - 1.2,
        y: H - 0.52,
        w: 1.2,
        h: 0.3,
        align: "right",
        fontSize: 9,
        color: dark ? PAPER_FAINT : INK_FAINT,
      });
    }

    if (slide.source) {
      s.addText(slide.source, {
        x: MARGIN,
        y: H - 0.52,
        w: CONTENT_W - 1.4,
        h: 0.3,
        fontSize: 9,
        color: dark ? PAPER_FAINT : INK_FAINT,
      });
    }

    // CC0 requires no attribution, so the credit rides in the speaker notes
    // rather than cluttering the slide.
    const notes = [slide.notes, slide.imageCredit].filter(Boolean).join("\n\n");
    if (notes) s.addNotes(notes);
  });

  await pptx.writeFile({ fileName: `${slugify(deck.title)}.pptx` });
}

function renderSlide(
  s: PptxSlide,
  slide: Slide,
  dark: boolean,
  treatment: Treatment,
) {
  // With a photo panel on the right, text has to stop before it.
  const textW = treatment === "panel" ? W * 0.53 - MARGIN : CONTENT_W;
  const bulletText = (items: string[], opts: { fontSize: number }) =>
    items.map((text) => ({
      text,
      options: {
        fontSize: opts.fontSize,
        color: dark ? PAPER : INK_SOFT,
        bullet: { characterCode: "25CF", indent: 18 },
        paraSpaceAfter: opts.fontSize * 0.6,
        lineSpacingMultiple: 1.15,
      },
    }));

  if (DIAGRAM_LAYOUTS.includes(slide.layout)) {
    addHeading(s, slide, dark, CONTENT_W);
    renderDiagram(s, slide, dark, {
      x: MARGIN,
      y: 1.85,
      w: CONTENT_W,
      h: H - 1.85 - 0.75,
    });
    return;
  }

  switch (slide.layout) {
    case "capa": {
      const hasSub = Boolean(slide.subtitle);
      s.addShape("rect", {
        x: MARGIN,
        y: hasSub ? 2.55 : 3.05,
        w: 1.1,
        h: 0.09,
        fill: { color: dark ? PAPER : CLINICAL },
        line: { type: "none" },
      });
      s.addText(slide.title, {
        x: MARGIN,
        y: hasSub ? 2.8 : 3.3,
        w: CONTENT_W,
        h: 1.5,
        fontSize: 38,
        bold: false,
        color: dark ? PAPER : INK,
        valign: "top",
        lineSpacingMultiple: 1.02,
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: MARGIN,
          y: 4.35,
          w: CONTENT_W * 0.72,
          h: 0.7,
          fontSize: 14,
          color: dark ? PAPER : INK_SOFT,
          valign: "top",
        });
      }
      return;
    }

    case "secao": {
      s.addText(slide.title, {
        x: MARGIN,
        y: 1.9,
        w: CONTENT_W * 0.68,
        h: 1.4,
        fontSize: 32,
        color: PAPER,
        valign: "top",
        lineSpacingMultiple: 1.1,
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: MARGIN,
          y: 3.35,
          w: CONTENT_W * 0.8,
          h: 0.9,
          fontSize: 14,
          color: PAPER_MUTED,
          valign: "top",
        });
      }
      return;
    }

    case "destaque": {
      s.addText(slide.title.toUpperCase(), {
        x: MARGIN,
        y: 1.1,
        w: CONTENT_W,
        h: 0.4,
        fontSize: 12,
        charSpacing: 2,
        color: PAPER_FAINT,
      });
      if (slide.stat) {
        s.addText(slide.stat.value, {
          x: MARGIN,
          y: 1.55,
          w: CONTENT_W,
          h: 1.5,
          fontSize: 72,
          color: PAPER,
          valign: "top",
        });
        s.addText(slide.stat.label, {
          x: MARGIN,
          y: 3.1,
          w: CONTENT_W * 0.85,
          h: 0.8,
          fontSize: 16,
          color: PAPER_MUTED,
          valign: "top",
        });
      }
      if (slide.bullets?.length) {
        s.addText(bulletText(slide.bullets, { fontSize: 12 }), {
          x: MARGIN,
          y: 3.95,
          w: CONTENT_W,
          h: 1.1,
          valign: "top",
        });
      }
      return;
    }

    case "comparacao": {
      addHeading(s, slide, dark, textW);
      const colW = (CONTENT_W - 0.6) / 2;
      [slide.left, slide.right].forEach((col, i) => {
        if (!col) return;
        const x = MARGIN + i * (colW + 0.6);
        s.addShape("rect", {
          x,
          y: 2.15,
          w: colW,
          h: 0.05,
          fill: { color: dark ? PAPER : CLINICAL },
          line: { type: "none" },
        });
        s.addText(col.heading, {
          x,
          y: 2.3,
          w: colW,
          h: 0.5,
          fontSize: 14,
          bold: true,
          color: dark ? PAPER : CLINICAL_DEEP,
          valign: "top",
        });
        s.addText(bulletText(col.bullets, { fontSize: 12 }), {
          x,
          y: 2.85,
          w: colW,
          h: 2.1,
          valign: "top",
        });
      });
      return;
    }

    case "encerramento": {
      addHeading(s, slide, dark, textW);
      (slide.bullets ?? []).forEach((b, i) => {
        const y = 2.2 + i * 0.62;
        s.addText(String(i + 1).padStart(2, "0"), {
          x: MARGIN,
          y,
          w: 0.5,
          h: 0.45,
          fontSize: 15,
          color: SIGNAL,
          valign: "top",
        });
        s.addText(b, {
          x: MARGIN + 0.55,
          y,
          w: textW - 0.55,
          h: 0.6,
          fontSize: 14,
          color: dark ? PAPER : INK,
          valign: "top",
          lineSpacingMultiple: 1.15,
        });
      });
      return;
    }

    default: {
      addHeading(s, slide, dark, textW);
      s.addText(bulletText(slide.bullets ?? [], { fontSize: 13 }), {
        x: MARGIN,
        y: 2.15,
        w: textW,
        h: 2.8,
        valign: "top",
      });
    }
  }
}

function addHeading(s: PptxSlide, slide: Slide, dark: boolean, textW: number) {
  s.addText(slide.title, {
    x: MARGIN,
    y: 0.75,
    w: textW,
    h: 0.95,
    fontSize: 24,
    color: dark ? PAPER : INK,
    valign: "top",
    lineSpacingMultiple: 1.15,
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: MARGIN,
      y: 1.65,
      w: textW,
      h: 0.45,
      fontSize: 12,
      color: dark ? PAPER : INK_FAINT,
      valign: "top",
    });
  }
}
