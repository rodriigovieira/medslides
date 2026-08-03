import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { sanitizeSlide } from "../src/lib/deck";

/**
 * Mutations for the AI editor. Separate from `chat.ts` because that file runs
 * in Node (it calls the model over fetch) and Convex only allows actions there.
 */
type Op = {
  tipo?: string;
  slide?: number;
  layout?: string;
  titulo?: string;
  subtitulo?: string;
  topicos?: string[];
  notas?: string;
  hub?: string;
  outcome?: string;
  nos?: Array<{ heading?: string; body?: string }>;
  imageQuery?: string;
  citationQuery?: string;
  removerImagem?: boolean;
};

export const applyOps = internalMutation({
  args: { deckId: v.id("decks"), ops: v.string() },
  handler: async (ctx, { deckId, ops: raw }) => {
    const empty = { applied: 0, refSlides: [], imageSlides: [] };
    const deck = await ctx.db.get(deckId);
    if (!deck) return empty;

    const ops = JSON.parse(raw) as Op[];
    let slides = [...deck.slides];
    let applied = 0;

    // Slides whose photo or sources have to be (re)fetched afterwards. They're
    // tracked by object identity rather than by index because the removals and
    // insertions below move every index that follows them; the final positions
    // are only knowable once the array has settled.
    const needsPhoto = new Set<object>();
    const needsRefs = new Set<object>();

    const index = (op: Op) => (op.slide ?? 0) - 1;

    // Edits first, while indexes still match what the model was shown.
    for (const op of ops.filter((o) => o.tipo === "editar")) {
      const i = index(op);
      if (i < 0 || i >= slides.length) continue;
      const patch: Record<string, unknown> = {};
      if (op.titulo?.trim()) patch.title = op.titulo.trim();
      if (op.subtitulo?.trim()) patch.subtitle = op.subtitulo.trim();
      if (op.notas?.trim()) patch.notes = op.notas.trim();
      if (op.hub?.trim()) patch.hub = op.hub.trim();
      if (op.outcome?.trim()) patch.outcome = op.outcome.trim();
      if (Array.isArray(op.topicos) && op.topicos.length > 0) {
        patch.bullets = op.topicos.filter((b) => b?.trim()).slice(0, 6);
      }
      if (Array.isArray(op.nos) && op.nos.length > 0) {
        patch.nodes = op.nos
          .filter((n) => n?.heading?.trim())
          .slice(0, 6)
          .map((n) => ({
            heading: n.heading!.trim(),
            ...(n.body?.trim() ? { body: n.body.trim() } : {}),
          }));
      }
      if (Object.keys(patch).length === 0) continue;
      slides[i] = { ...slides[i], ...patch };
      applied++;
    }

    // Photo swaps, still on the numbering the model was shown. Clearing the
    // stored file is what makes this a *swap*: the slide renders text-only for
    // the few seconds until the new photo lands, which reads as the change
    // happening rather than as nothing having happened.
    for (const op of ops.filter((o) => o.tipo === "imagem")) {
      const i = index(op);
      if (i < 0 || i >= slides.length) continue;
      const query = op.imageQuery?.trim();
      if (!query) continue;
      const next = {
        ...slides[i],
        imageQuery: query,
        imageStorageId: undefined,
        imageUrl: undefined,
        imageCredit: undefined,
        // `imageSource` deliberately survives: it's the photo being replaced,
        // and leaving it in place is what stops the search from handing back the
        // very picture the user just asked to be rid of.
      };
      slides[i] = next;
      needsPhoto.add(next);
      applied++;
    }

    // Then removals, highest index first so earlier indexes stay valid.
    for (const op of ops
      .filter((o) => o.tipo === "remover")
      .sort((a, b) => index(b) - index(a))) {
      const i = index(op);
      if (i < 0 || i >= slides.length || slides.length <= 2) continue;
      slides.splice(i, 1);
      applied++;
    }

    // Additions last, also descending, for the same reason.
    for (const op of ops
      .filter((o) => o.tipo === "adicionar")
      .sort((a, b) => index(b) - index(a))) {
      const candidate = sanitizeSlide({
        layout: op.layout ?? "topicos",
        title: op.titulo,
        subtitle: op.subtitulo,
        bullets: op.topicos,
        hub: op.hub,
        outcome: op.outcome,
        nodes: op.nos,
        notes: op.notas,
        imageQuery: op.imageQuery,
        citationQuery: op.citationQuery,
      });
      if (!candidate) continue;
      const at = Math.max(0, Math.min(slides.length, index(op)));
      slides.splice(at, 0, candidate);
      // A slide added by chat starts bare. Left that way it sits next to slides
      // that carry a photo and a footnote and reads as broken, so it queues for
      // the same enrichment the generator runs.
      if (candidate.citationQuery) needsRefs.add(candidate);
      if (candidate.imageQuery) needsPhoto.add(candidate);
      applied++;
    }

    if (applied === 0) return empty;
    // 25 is the generator's own ceiling; keep the editor inside it.
    slides = slides.slice(0, 25);

    // Keep the closing slide closing. Asked for three slides on vasopressors,
    // the model placed one before "Mensagens Finais" and two after it — each
    // position defensible on its own, the result absurd. The deck has exactly
    // one closing slide and its whole job is to be last, so this is settled
    // here rather than argued with the model in the prompt.
    const closing = slides.filter((s) => s.layout === "encerramento");
    if (closing.length === 1 && slides.indexOf(closing[0]) !== slides.length - 1) {
      slides = [...slides.filter((s) => s !== closing[0]), closing[0]];
    }
    await ctx.db.patch(deckId, { slides });

    // Resolve the tracked slides to their settled positions; anything that fell
    // off the 25-slide ceiling simply isn't there to enrich.
    const positions = (tracked: Set<object>) =>
      slides
        .map((slide, i) => (tracked.has(slide) ? i : -1))
        .filter((i) => i >= 0);

    return {
      applied,
      refSlides: positions(needsRefs),
      imageSlides: positions(needsPhoto),
    };
  },
  returns: v.object({
    applied: v.number(),
    refSlides: v.array(v.number()),
    imageSlides: v.array(v.number()),
  }),
});

export const appendMessage = internalMutation({
  args: {
    deckId: v.id("decks"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
  },
  handler: async (ctx, { deckId, role, text }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) return;
    // Keep the tail only; the conversation is a working log, not an archive.
    const chat = [...(deck.chat ?? []), { role, text, at: Date.now() }].slice(-40);
    await ctx.db.patch(deckId, { chat });
  },
});

/**
 * Applies a one-slide patch. Text fields go through `sanitizeSlide`, then the
 * fields the model never sees — attached photo, verified reference numbers, the
 * citation query — are copied back from the stored slide. Skipping that step is
 * how an "edit" quietly deletes a citation.
 */
export const applySlidePatch = internalMutation({
  args: {
    deckId: v.id("decks"),
    slideIndex: v.number(),
    patch: v.string(),
  },
  handler: async (ctx, { deckId, slideIndex, patch: raw }) => {
    const nothing = { changed: false, needsPhoto: false };
    const deck = await ctx.db.get(deckId);
    if (!deck) return nothing;
    const current = deck.slides[slideIndex];
    if (!current) return nothing;

    const p = JSON.parse(raw) as Op;
    const becomesDiagram =
      typeof p.layout === "string" &&
      ["mecanismo", "fluxo", "cards"].includes(p.layout) &&
      Array.isArray(p.nos) &&
      p.nos.length > 0;

    const candidate = sanitizeSlide({
      layout: p.layout ?? current.layout,
      title: p.titulo?.trim() || current.title,
      subtitle: p.subtitulo?.trim() ?? current.subtitle,
      // A slide that became a diagram must lose its bullets, or it renders both.
      bullets: becomesDiagram ? undefined : (p.topicos ?? current.bullets),
      hub: p.hub?.trim() ?? current.hub,
      nodes: p.nos?.length ? p.nos : current.nodes,
      outcome: p.outcome?.trim() ?? current.outcome,
      stat: current.stat,
      left: current.left,
      right: current.right,
      notes: p.notas?.trim() || current.notes,
    });
    if (!candidate) return nothing;

    // The photo only moves when this edit asked it to. Everything else about it
    // is carried over untouched — the model never sees the stored file, and an
    // "encurtar este slide" that dropped the photo would be a silent deletion.
    const wantsNewPhoto = Boolean(p.imageQuery?.trim());
    const dropsPhoto = p.removerImagem === true;
    const photo =
      wantsNewPhoto || dropsPhoto
        ? {
            imageQuery: wantsNewPhoto ? p.imageQuery!.trim() : undefined,
            imageCredit: undefined,
            imageStorageId: undefined,
            // Kept on a swap so the search can't return the same photo again;
            // cleared on a removal, where nothing is coming to replace it.
            imageSource: dropsPhoto ? undefined : current.imageSource,
          }
        : {
            imageQuery: current.imageQuery,
            imageCredit: current.imageCredit,
            imageStorageId: current.imageStorageId,
            imageSource: current.imageSource,
          };

    const slides = [...deck.slides];
    slides[slideIndex] = {
      ...candidate,
      source: current.source,
      citationQuery: current.citationQuery,
      refs: current.refs,
      ...photo,
    };
    await ctx.db.patch(deckId, { slides });
    return { changed: true, needsPhoto: wantsNewPhoto };
  },
  returns: v.object({ changed: v.boolean(), needsPhoto: v.boolean() }),
});
