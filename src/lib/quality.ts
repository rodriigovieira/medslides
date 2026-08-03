import { DIAGRAM_LAYOUTS, type Deck, type Slide } from "./deck";
import { fitSlide } from "./fit";

/**
 * A measurable stand-in for "does this deck look good".
 *
 * Grounded in two lines of work rather than taste:
 *
 * - Alley's **assertion-evidence** structure (Penn State): every slide carries a
 *   sentence assertion as its headline and *visual* evidence beneath it, not a
 *   bullet list. Repeatedly shown to beat topic-and-bullets for comprehension
 *   and recall of technical content.
 * - The unsupervised slide-quality work in arXiv:2508.19289, which scores slides
 *   on expert-inspired visual metrics — whitespace, text density, edge density,
 *   contrast, layout balance — and correlates ~0.83 with human ratings.
 *
 * We score the semantic deck rather than pixels: we know the bullet counts, the
 * layouts and the fitted type scale, which is strictly more information than a
 * screenshot. Every metric is 0–1, higher is better.
 */

export type Metric = {
  id: string;
  label: string;
  score: number;
  detail: string;
};

export type QualityReport = {
  overall: number;
  metrics: Metric[];
  worstSlides: Array<{ index: number; reason: string }>;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * `imageUrl` is resolved at query time; a raw database export carries only
 * `imageStorageId`. Scoring a snapshot has to accept either, or every deck
 * reads as having no images.
 */
function hasPhoto(slide: Slide): boolean {
  return Boolean(
    slide.imageUrl || (slide as { imageStorageId?: string }).imageStorageId,
  );
}

/** Slides whose whole job is a visual or a transition carry no body text. */
function isTextSlide(slide: Slide): boolean {
  return (
    slide.layout === "topicos" ||
    slide.layout === "encerramento" ||
    slide.layout === "comparacao"
  );
}

function slideChars(slide: Slide): number {
  const parts = [
    slide.title,
    slide.subtitle ?? "",
    ...(slide.bullets ?? []),
    ...(slide.left?.bullets ?? []),
    ...(slide.right?.bullets ?? []),
    ...(slide.nodes ?? []).flatMap((n) => [n.heading, n.body ?? ""]),
  ];
  return parts.join(" ").length;
}

/**
 * An assertion makes a claim; a topic just names one. Portuguese verbs give it
 * away — a headline with a conjugated verb ("Lactato define choque") asserts,
 * where a noun phrase ("Lactato") does not.
 */
function isAssertion(title: string): boolean {
  if (title.trim().split(/\s+/).length < 3) return false;
  return /\b\w+(a|e|am|em|ou|ram|ão|se|á|é|induz|reduz|aumenta|define|exige|indica|melhora|salva|guia|deve|precisa|muda|evita|previne)\b/i.test(
    title,
  );
}

export function scoreDeck(deck: Deck): QualityReport {
  const slides = deck.slides;
  if (slides.length === 0) {
    return { overall: 0, metrics: [], worstSlides: [] };
  }

  const worst: Array<{ index: number; reason: string }> = [];

  // 1. Overflow — the hard failure. Any slide that needed shrinking below 1.0
  //    was over-full; anything still over at the floor is genuinely broken.
  let overflowing = 0;
  let shrunk = 0;
  slides.forEach((slide, i) => {
    const fit = fitSlide({
      slide,
      panel: hasPhoto(slide) && isTextSlide(slide),
      hasRefs: (slide.refs?.length ?? 0) > 0,
    });
    if (fit.scale <= 0.74) {
      overflowing++;
      worst.push({ index: i, reason: "texto excede a altura do slide" });
    } else if (fit.scale < 1) {
      shrunk++;
    }
  });
  const overflow = clamp01(1 - overflowing / slides.length);

  // 2. Text density — Mayer's coherence principle; less text, better recall.
  const textSlides = slides.filter(isTextSlide);
  const avgChars =
    textSlides.length > 0
      ? textSlides.reduce((s, x) => s + slideChars(x), 0) / textSlides.length
      : 0;
  // ~220 chars is a comfortable projected slide; 400+ is a document.
  const density = clamp01(1 - (avgChars - 220) / 260);
  textSlides.forEach((slide) => {
    if (slideChars(slide) > 420) {
      worst.push({
        index: slides.indexOf(slide),
        reason: `denso demais (${slideChars(slide)} caracteres)`,
      });
    }
  });

  // 3. Bullet discipline — ≤5 per slide, ≤12 words each.
  const allBullets = slides.flatMap((s) => s.bullets ?? []);
  const longBullets = allBullets.filter(
    (b) => b.trim().split(/\s+/).length > 12,
  ).length;
  const overBulleted = slides.filter((s) => (s.bullets?.length ?? 0) > 5).length;
  const bulletScore = clamp01(
    1 -
      (allBullets.length > 0 ? longBullets / allBullets.length : 0) * 0.7 -
      (overBulleted / slides.length) * 0.6,
  );

  // 4. Visual evidence — the assertion-evidence core: a slide should show
  //    something, not just list. Photo or diagram both count.
  const withVisual = slides.filter(
    (s) => hasPhoto(s) || DIAGRAM_LAYOUTS.includes(s.layout) || s.stat,
  ).length;
  const visual = clamp01(withVisual / slides.length / 0.7);

  // 5. Assertion headlines rather than topic labels.
  const assertions = slides.filter((s) => isAssertion(s.title)).length;
  const assertion = clamp01(assertions / slides.length / 0.8);

  // 6. Layout variety — a deck of nothing but bullet slides reads flat.
  const distinct = new Set(slides.map((s) => s.layout)).size;
  const variety = clamp01(distinct / 5);

  // 7. Evidence — verified references attached.
  const cited = slides.filter((s) => (s.refs?.length ?? 0) > 0).length;
  const evidence = clamp01(cited / slides.length / 0.5);

  const metrics: Metric[] = [
    {
      id: "overflow",
      label: "Cabe no slide",
      score: overflow,
      detail: `${overflowing} slide(s) estouram, ${shrunk} precisaram encolher`,
    },
    {
      id: "density",
      label: "Densidade de texto",
      score: density,
      detail: `${Math.round(avgChars)} caracteres por slide de conteúdo`,
    },
    {
      id: "bullets",
      label: "Disciplina de tópicos",
      score: bulletScore,
      detail: `${longBullets}/${allBullets.length} tópicos acima de 12 palavras`,
    },
    {
      id: "visual",
      label: "Evidência visual",
      score: visual,
      detail: `${withVisual}/${slides.length} slides com imagem, diagrama ou número`,
    },
    {
      id: "assertion",
      label: "Títulos que afirmam",
      score: assertion,
      detail: `${assertions}/${slides.length} títulos são afirmações`,
    },
    {
      id: "variety",
      label: "Variedade de layout",
      score: variety,
      detail: `${distinct} layouts distintos`,
    },
    {
      id: "evidence",
      label: "Referências verificadas",
      score: evidence,
      detail: `${cited}/${slides.length} slides com referência do PubMed`,
    },
  ];

  // Overflow is weighted hardest: it is the one flaw an audience cannot ignore.
  const weights: Record<string, number> = {
    overflow: 2.5,
    density: 1.5,
    bullets: 1.2,
    visual: 1.5,
    assertion: 1,
    variety: 0.8,
    evidence: 0.8,
  };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const overall =
    metrics.reduce((sum, m) => sum + m.score * (weights[m.id] ?? 1), 0) /
    totalWeight;

  return {
    overall: Math.round(overall * 100) / 100,
    metrics,
    worstSlides: worst.slice(0, 6),
  };
}
