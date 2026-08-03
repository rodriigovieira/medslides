import type PptxGenJS from "pptxgenjs";
import {
  AI_CREDIT,
  DIAGRAM_LAYOUTS,
  citationLine,
  type Deck,
  type Slide,
} from "./deck";
import { composeSlideImage, treatmentFor, type Treatment } from "./compose";
import { renderDiagram } from "./pptxDiagram";
import { fitSlide } from "./fit";

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

    // Only PubMed-verified references reach the slide.
    const cited = (slide.refs ?? [])
      .map((n) => deck.references?.find((r) => r.n === n))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .slice(0, 2);

    // Same fitting the renderer uses, so an over-full slide shrinks in the
    // file exactly as it does on screen instead of running off the edge.
    const fit = fitSlide({
      slide,
      panel: treatment === "panel",
      hasRefs: cited.length > 0,
    });
    renderSlide(s, slide, dark, treatment, fit.scale);

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

    if (cited.length > 0) {
      s.addText(
        cited
          .map(
            (r) =>
              `${r.n}. ${citationLine(r)} PMID ${r.pmid}`,
          )
          .join("\n"),
        {
          x: MARGIN,
          y: H - 0.72,
          w: CONTENT_W - 1.4,
          h: 0.5,
          fontSize: 7.5,
          color: dark ? PAPER_FAINT : INK_FAINT,
          valign: "bottom",
          lineSpacingMultiple: 1.15,
        },
      );
    }

    // A stock photo is CC0, so its credit needs no attribution and rides in the
    // notes. A generated image is different in kind: the audience is looking at
    // something invented, and the deck leaves the room without us, so the label
    // has to be on the slide it belongs to.
    if (slide.imageCredit === AI_CREDIT) {
      s.addText(`✦ ${AI_CREDIT}`, {
        x: MARGIN,
        y: H - 0.28,
        w: 3,
        h: 0.22,
        fontSize: 6.5,
        color: dark ? PAPER_FAINT : INK_FAINT,
      });
    }

    const notes = [slide.notes, slide.imageCredit].filter(Boolean).join("\n\n");
    if (notes) s.addNotes(notes);
  });

  addReferencesSlide(pptx, deck);

  await pptx.writeFile({ fileName: `${slugify(deck.title)}.pptx` });
}

/** Closing bibliography — every entry has a PMID the audience can look up. */
function addReferencesSlide(
  pptx: InstanceType<typeof PptxGenJS>,
  deck: Deck,
) {
  const refs = deck.references ?? [];
  if (refs.length === 0) return;

  const s = pptx.addSlide();
  s.background = { color: PAPER };
  s.addShape("rect", {
    x: 0,
    y: 0,
    w: 1.5,
    h: 0.085,
    fill: { color: CLINICAL },
    line: { type: "none" },
  });
  s.addText("Referências", {
    x: MARGIN,
    y: 0.75,
    w: CONTENT_W,
    h: 0.6,
    fontSize: 24,
    color: INK,
    valign: "top",
  });

  s.addText(
    refs.map((r) => ({
      text: `${r.n}. ${r.title}. ${citationLine(r)} PMID ${r.pmid}`,
      options: {
        fontSize: refs.length > 8 ? 8.5 : 10,
        color: INK_SOFT,
        breakLine: true,
        paraSpaceAfter: 4,
      },
    })),
    {
      x: MARGIN,
      y: 1.5,
      w: CONTENT_W,
      h: H - 2.2,
      valign: "top",
      lineSpacingMultiple: 1.1,
    },
  );

  s.addNotes(
    "Referências localizadas no PubMed a partir do tema de cada slide. Confirme se sustentam a afirmação antes de apresentar.",
  );
}

function renderSlide(
  s: PptxSlide,
  slide: Slide,
  dark: boolean,
  treatment: Treatment,
  scale = 1,
) {
  // With a photo panel on the right, text has to stop before it.
  const textW = treatment === "panel" ? W * 0.53 - MARGIN : CONTENT_W;
  const bulletText = (items: string[], opts: { fontSize: number }) =>
    items.map((text) => ({
      text,
      options: {
        fontSize: opts.fontSize * scale,
        color: dark ? PAPER : INK_SOFT,
        bullet: { characterCode: "25CF", indent: 18 },
        paraSpaceAfter: opts.fontSize * 0.6,
        lineSpacingMultiple: 1.15,
      },
    }));

  if (DIAGRAM_LAYOUTS.includes(slide.layout)) {
    addHeading(s, slide, dark, CONTENT_W, scale);
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
      addHeading(s, slide, dark, textW, scale);
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
      addHeading(s, slide, dark, textW, scale);
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
      addHeading(s, slide, dark, textW, scale);
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

function addHeading(
  s: PptxSlide,
  slide: Slide,
  dark: boolean,
  textW: number,
  scale = 1,
) {
  s.addText(slide.title, {
    x: MARGIN,
    y: 0.75,
    w: textW,
    h: 0.95,
    fontSize: 24 * scale,
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
