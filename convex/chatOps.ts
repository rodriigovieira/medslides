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
};

export const applyOps = internalMutation({
  args: { deckId: v.id("decks"), ops: v.string() },
  handler: async (ctx, { deckId, ops: raw }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) return 0;

    const ops = JSON.parse(raw) as Op[];
    let slides = [...deck.slides];
    let applied = 0;

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
      });
      if (!candidate) continue;
      const at = Math.max(0, Math.min(slides.length, index(op)));
      slides.splice(at, 0, candidate);
      applied++;
    }

    if (applied === 0) return 0;
    // 25 is the generator's own ceiling; keep the editor inside it.
    slides = slides.slice(0, 25);
    await ctx.db.patch(deckId, { slides });
    return applied;
  },
  returns: v.number(),
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
    const deck = await ctx.db.get(deckId);
    if (!deck) return false;
    const current = deck.slides[slideIndex];
    if (!current) return false;

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
    if (!candidate) return false;

    const slides = [...deck.slides];
    slides[slideIndex] = {
      ...candidate,
      source: current.source,
      citationQuery: current.citationQuery,
      refs: current.refs,
      imageQuery: current.imageQuery,
      imageCredit: current.imageCredit,
      imageStorageId: current.imageStorageId,
    };
    await ctx.db.patch(deckId, { slides });
    return true;
  },
  returns: v.boolean(),
});
