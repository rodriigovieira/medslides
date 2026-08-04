import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { Slide } from "../src/lib/deck";

/**
 * A demo slide is a normal slide plus `asset`: the name of a generated
 * illustration to resolve at creation time. `asset` never reaches the database —
 * it is replaced by the stored file's URL.
 */
type DemoSlide = Slide & { asset?: string };

/**
 * The showcase deck.
 *
 * Hand-authored rather than generated, for three reasons. It has to open
 * *instantly* — a salesperson with someone's attention cannot spend ninety
 * seconds watching a spinner. It has to be the *same* deck every time, so a demo
 * that worked yesterday works in front of a customer today. And it costs
 * nothing, so it can be shown a hundred times.
 *
 * The clinical content is deliberately cardio-oncology: it is the subject of the
 * professionally-produced deck this motion vocabulary was reverse-engineered
 * from, so a customer who has seen that kind of talk recognises the shape.
 *
 * What is *not* hand-authored is the evidence. The references are looked up in
 * PubMed by the same pipeline every other deck uses, from the `citationQuery` on
 * each slide. Shipping a demo with plausible-looking invented citations would
 * contradict the one promise this product makes, in the exact artefact we use to
 * make the promise.
 */

/** The slides that move, and why each one is here. */
const SLIDES: DemoSlide[] = [
  {
    layout: "capa",
    title: "Cardio-oncologia: proteger o coração sem interromper o câncer",
    subtitle: "O que mudou na avaliação de risco e na vigilância",
    imageQuery: "hospital corridor light",
    // The cover sets the tone and then gets out of the way.
    animation: { preset: "suave" },
  },
  {
    layout: "secao",
    title: "O problema não é raro — é subdiagnosticado",
    imageQuery: "cardiology consultation",
    animation: { preset: "suave" },
  },
  {
    // --- the travelling heart, part 1 of 3 ------------------------------------
    // One generated illustration, held across three slides and moved rather
    // than replaced. It arrives alone and centred, big enough to be the whole
    // slide; nothing competes with it.
    layout: "topicos",
    title: "O coração entra na conta do tratamento oncológico",
    asset: "coracao",
    imagePlacement: "centro",
    imageStyle: "ilustracao",
    animation: { preset: "suave", pace: "solene" },
  },
  {
    // Part 2. Same file, now at the side: the engine matches the two by URL and
    // flies it there while the pathways build in the space it vacated. This is
    // the effect the whole motion vocabulary was built to produce.
    layout: "cards",
    title: "Quatro frentes de dano, um só órgão",
    asset: "coracao",
    imagePlacement: "esquerda",
    imageStyle: "ilustracao",
    nodes: [
      { heading: "Miócito", body: "Apoptose e perda de massa contrátil" },
      { heading: "Microvasculatura", body: "Isquemia e disfunção endotelial" },
      { heading: "Pericárdio", body: "Inflamação e derrame" },
      { heading: "Valvas", body: "Fibrose tardia, sobretudo pós-radioterapia" },
    ],
    citationQuery: "cancer therapy related cardiovascular toxicity mechanisms",
    animation: { preset: "transformar", pace: "solene" },
  },
  {
    // The number that the next slide's diagram grows out of. This pair is the
    // whole point of `transformar`: the figure does not get replaced, it moves.
    layout: "destaque",
    title: "Disfunção ventricular após antraciclina",
    stat: { value: "9%", label: "dos pacientes em até 12 meses, a maioria assintomática" },
    citationQuery: "anthracycline cardiotoxicity incidence left ventricular dysfunction",
    imageQuery: "echocardiography room",
    animation: { preset: "numero", pace: "solene" },
  },
  {
    layout: "mecanismo",
    title: "Como a antraciclina lesa o miócito",
    hub: "9%",
    nodes: [
      { heading: "Topoisomerase 2B", body: "Quebra de fita dupla no DNA mitocondrial" },
      { heading: "Estresse oxidativo", body: "Radicais livres saturam a defesa local" },
      { heading: "Disfunção mitocondrial", body: "Queda de ATP e ativação de apoptose" },
      { heading: "Fibrose intersticial", body: "Miócitos substituídos por matriz não contrátil" },
    ],
    outcome: "Queda da fração de ejeção",
    citationQuery: "anthracycline topoisomerase 2b cardiotoxicity mechanism",
    notes:
      "Este slide entra com o efeito herói: o número do slide anterior chega ao centro, é lido sozinho, e então desliza para a esquerda encolhendo enquanto as vias aparecem à direita.",
    animation: { preset: "heroi", pace: "solene" },
  },
  {
    layout: "fluxo",
    title: "A vigilância é um protocolo, não uma opinião",
    nodes: [
      { heading: "Estratificar", body: "Risco basal antes da primeira dose" },
      { heading: "Ecocardiograma", body: "FEVE e strain longitudinal global" },
      { heading: "Repetir", body: "Conforme o risco e a dose acumulada" },
      { heading: "Agir cedo", body: "Cardioproteção antes da queda sintomática" },
    ],
    citationQuery: "cardio-oncology surveillance echocardiography global longitudinal strain",
    animation: { preset: "etapas" },
  },
  {
    layout: "topicos",
    title: "O strain detecta antes da fração de ejeção",
    bullets: [
      "Queda relativa >15% no GLS antecede a queda da FEVE",
      "Permite intervir enquanto a disfunção é reversível",
      "Reprodutível quando o mesmo equipamento é usado na série",
    ],
    citationQuery: "global longitudinal strain early detection cardiotoxicity",
    imageQuery: "cardiac ultrasound screen",
    animation: { preset: "progressiva" },
  },
  {
    layout: "comparacao",
    title: "Interromper nem sempre é a conduta mais segura",
    left: {
      heading: "Interromper o oncológico",
      bullets: ["Protege o miocárdio no curto prazo", "Custa controle da doença de base"],
    },
    right: {
      heading: "Manter com cardioproteção",
      bullets: ["IECA/BRA e betabloqueador", "Vigilância mais próxima", "Decisão conjunta com a oncologia"],
    },
    citationQuery: "cardioprotection continue cancer therapy cardiotoxicity management",
    animation: { preset: "suave" },
  },
  {
    layout: "cards",
    title: "Quem merece vigilância mais próxima",
    nodes: [
      { heading: "Dose acumulada alta", body: "Doxorrubicina acima de 250 mg/m²" },
      { heading: "Radioterapia torácica", body: "Campo incluindo o coração" },
      { heading: "FEVE limítrofe", body: "Abaixo de 55% antes de começar" },
      { heading: "Fatores clássicos", body: "Hipertensão, diabetes, idade avançada" },
    ],
    citationQuery: "cardiotoxicity risk stratification baseline assessment",
    // Deliberately still. In the deck this vocabulary came from, 17 of 32
    // slides do not move at all — the restraint is what makes the rest land.
    animation: { preset: "nenhuma" },
  },
  {
    layout: "destaque",
    title: "Detecção precoce muda o desfecho",
    stat: { value: "82%", label: "recuperam a função quando tratados no primeiro semestre" },
    citationQuery: "early treatment cardiotoxicity recovery left ventricular function",
    imageQuery: "doctor reviewing chart",
    animation: { preset: "destacar" },
  },
  {
    layout: "encerramento",
    title: "O que levar para a prática",
    bullets: [
      "Estratifique o risco antes da primeira dose",
      "Peça strain, não só fração de ejeção",
      "Cardioproteção precoce preserva o tratamento oncológico",
      "A decisão é conjunta com a oncologia, sempre",
    ],
    imageQuery: "medical team discussion",
    animation: { preset: "suave" },
  },
];

/**
 * Creates the demo deck for this browser and returns its id.
 *
 * Deliberately *not* deduplicated against an existing copy: the point of the
 * button is that it always yields a pristine deck to demonstrate on, and the
 * previous one may have been edited mid-conversation with a customer.
 *
 * It does not consume the daily generation quota either. Nothing is generated —
 * no model is called — so charging for it would only stop someone showing the
 * product.
 */
export const create = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    if (!clientId) throw new Error("Sessão inválida. Recarregue a página.");

    // Resolve the shared artwork once. `asset` is a demo-only marker, not a
    // slide field — it never reaches the database.
    // The stored *id*, not a URL: the schema keeps `imageStorageId` and
    // `decks.get` resolves it per read. Writing a resolved URL straight onto the
    // slide is rejected by the validator — and would also rot, since storage
    // URLs are not promised to be stable.
    const assetIds = new Map<string, string | null>();
    for (const name of new Set(
      SLIDES.map((slide) => slide.asset).filter(
        (name): name is string => Boolean(name),
      ),
    )) {
      assetIds.set(name, await ctx.runQuery(internal.demoAssetStore.read, { name }));
    }

    const slides = SLIDES.map(({ asset, ...slide }) => {
      const storageId = asset ? assetIds.get(asset) : null;
      // Without the artwork the slide still stands — it just loses the picture,
      // and with it the travelling effect. Better than refusing to open.
      return storageId
        ? { ...slide, imageStorageId: storageId as Id<"_storage"> }
        : slide;
    });

    const deckId = await ctx.db.insert("decks", {
      topic: "Cardio-oncologia: proteger o coração sem interromper o câncer",
      audience: "Colegas especialistas (congresso)",
      slideCount: slides.length,
      depth: "aprofundado",
      title: "Cardio-oncologia",
      subtitle: "Proteger o coração sem interromper o câncer",
      slides,
      status: "pronto",
      // The text is already here, so the deck is presentable immediately. The
      // phase still runs through references and images, which doubles as a live
      // demonstration of the enrichment the real product does.
      phase: "referencias",
      clientId,
      createdAt: Date.now(),
    });

    // Make sure the artwork exists for *next* time. The first demo ever opened
    // on a deployment shows without it — one salesperson sees a slide with no
    // heart, rather than everyone waiting ten seconds for one.
    for (const [name, id] of assetIds) {
      if (!id) {
        await ctx.scheduler.runAfter(0, internal.demoAssets.ensure, { name });
      }
    }

    await ctx.scheduler.runAfter(0, internal.generate.enrich, {
      deckId,
      slideIndexes: slides.map((_, index) => index),
      imageIndexes: slides
        .map((_, index) => index)
        .filter((index) => "imageQuery" in slides[index]),
      finishPhase: true,
    });

    return deckId;
  },
});
