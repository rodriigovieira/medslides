import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { slideValidator } from "./schema";

const DAILY_LIMIT_PER_CLIENT = 15;
const DAILY_LIMIT_GLOBAL = 400;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export const get = query({
  args: { deckId: v.id("decks") },
  handler: async (ctx, { deckId }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) return null;

    const slides = await Promise.all(
      deck.slides.map(async ({ imageStorageId, ...slide }) => {
        if (!imageStorageId) return slide;
        const imageUrl = await ctx.storage.getUrl(imageStorageId);
        return imageUrl ? { ...slide, imageUrl } : slide;
      }),
    );

    return { ...deck, slides };
  },
});

export const listMine = query({
  args: { clientId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { clientId, limit }) => {
    if (!clientId) return [];
    const decks = await ctx.db
      .query("decks")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .order("desc")
      .take(Math.min(limit ?? 12, 50));

    // The list only needs enough to render a row — slide bodies stay out of it.
    return decks.map((deck) => ({
      _id: deck._id,
      title: deck.title,
      topic: deck.topic,
      audience: deck.audience,
      status: deck.status,
      slideCount: deck.slides.length,
      createdAt: deck.createdAt,
    }));
  },
});

/**
 * Reserves one generation against both quotas, then creates the empty deck the
 * action will fill in. Throws if either quota is exhausted.
 */
export const start = mutation({
  args: {
    topic: v.string(),
    audience: v.string(),
    slideCount: v.number(),
    depth: v.union(v.literal("panorama"), v.literal("aprofundado")),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.topic.trim().length < 8) {
      throw new Error("Descreva o tema com um pouco mais de detalhe.");
    }
    if (args.topic.length > 600) {
      throw new Error("Tema longo demais — resuma em até 600 caracteres.");
    }
    if (args.slideCount < 5 || args.slideCount > 25) {
      throw new Error("Escolha entre 5 e 25 slides.");
    }
    if (!args.clientId) throw new Error("Sessão inválida. Recarregue a página.");

    await consume(ctx, "global", DAILY_LIMIT_GLOBAL, "GLOBAL_LIMIT");
    await consume(ctx, args.clientId, DAILY_LIMIT_PER_CLIENT, "CLIENT_LIMIT");

    const deckId = await ctx.db.insert("decks", {
      topic: args.topic.trim(),
      audience: args.audience,
      slideCount: args.slideCount,
      depth: args.depth,
      title: "",
      subtitle: "",
      slides: [],
      status: "gerando",
      phase: "texto",
      clientId: args.clientId,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.generate.run, {
      deckId,
      topic: args.topic.trim(),
      audience: args.audience,
      slideCount: args.slideCount,
      depth: args.depth,
    });

    return deckId;
  },
});

async function consume(
  ctx: MutationCtx,
  scope: string,
  limit: number,
  code: "GLOBAL_LIMIT" | "CLIENT_LIMIT",
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("usage")
    .withIndex("by_scope", (q) => q.eq("scope", scope))
    .unique();

  if (!existing) {
    await ctx.db.insert("usage", { scope, windowStart: now, count: 1 });
    return;
  }

  if (now - existing.windowStart > WINDOW_MS) {
    await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    return;
  }

  if (existing.count >= limit) {
    throw new Error(
      code === "GLOBAL_LIMIT"
        ? "O MedSlides atingiu o limite de uso de hoje. Tente novamente amanhã."
        : "Você atingiu o limite de apresentações por dia. Tente novamente amanhã.",
    );
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}

/** Called repeatedly by the generate action as slides finish parsing. */
export const applyProgress = internalMutation({
  args: {
    deckId: v.id("decks"),
    title: v.string(),
    subtitle: v.string(),
    slides: v.array(slideValidator),
  },
  handler: async (ctx, { deckId, title, subtitle, slides }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck || deck.status !== "gerando") return;
    await ctx.db.patch(deckId, { title, subtitle, slides });
  },
});

export const finish = internalMutation({
  args: {
    deckId: v.id("decks"),
    title: v.string(),
    subtitle: v.string(),
    slides: v.array(slideValidator),
    provider: v.union(v.literal("gemini"), v.literal("openai")),
    model: v.string(),
  },
  handler: async (ctx, { deckId, ...rest }) => {
    await ctx.db.patch(deckId, { ...rest, status: "pronto" });
  },
});

export const setPhase = internalMutation({
  args: {
    deckId: v.id("decks"),
    phase: v.union(
      v.literal("texto"),
      v.literal("referencias"),
      v.literal("imagens"),
      v.literal("pronto"),
    ),
  },
  handler: async (ctx, { deckId, phase }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) return;
    await ctx.db.patch(deckId, { phase });
  },
});

export const attachImage = internalMutation({
  args: {
    deckId: v.id("decks"),
    slideIndex: v.number(),
    storageId: v.id("_storage"),
    credit: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { deckId, slideIndex, storageId, credit, source }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) return;
    const slides = deck.slides.map((slide, index) =>
      index === slideIndex
        ? {
            ...slide,
            imageStorageId: storageId,
            imageCredit: credit,
            imageSource: source,
          }
        : slide,
    );
    await ctx.db.patch(deckId, { slides });
  },
});

export const fail = internalMutation({
  args: { deckId: v.id("decks"), error: v.string() },
  handler: async (ctx, { deckId, error }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) return;
    // A partial deck is still useful; keep the slides and flag what happened.
    await ctx.db.patch(deckId, {
      status: deck.slides.length >= 3 ? "pronto" : "erro",
      phase: "pronto",
      error,
    });
  },
});

export const attachReferences = internalMutation({
  args: {
    deckId: v.id("decks"),
    references: v.array(
      v.object({
        n: v.number(),
        pmid: v.string(),
        title: v.string(),
        authors: v.string(),
        journal: v.string(),
        year: v.string(),
        url: v.string(),
      }),
    ),
    slideRefs: v.array(
      v.object({ slideIndex: v.number(), refs: v.array(v.number()) }),
    ),
  },
  handler: async (ctx, { deckId, references, slideRefs }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) return;
    const byIndex = new Map(slideRefs.map((r) => [r.slideIndex, r.refs]));
    const slides = deck.slides.map((slide, index) => {
      const refs = byIndex.get(index);
      return refs ? { ...slide, refs } : slide;
    });
    await ctx.db.patch(deckId, { references, slides });
  },
});

/**
 * Adds sources for slides created after the deck was already numbered.
 *
 * Renumbering is not an option: the closing bibliography and every footnote
 * already rendered point at the current numbers, and a deck whose footnote "3"
 * silently starts meaning a different paper is worse than one with no footnote.
 * So an existing PMID keeps its number and anything new is appended.
 */
export const mergeReferences = internalMutation({
  args: {
    deckId: v.id("decks"),
    found: v.array(
      v.object({
        slideIndex: v.number(),
        refs: v.array(
          v.object({
            pmid: v.string(),
            title: v.string(),
            authors: v.string(),
            journal: v.string(),
            year: v.string(),
            url: v.string(),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, { deckId, found }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) return;

    const references = [...(deck.references ?? [])];
    const numberByPmid = new Map(references.map((r) => [r.pmid, r.n]));
    const refsBySlide = new Map<number, number[]>();

    for (const { slideIndex, refs } of found) {
      const numbers: number[] = [];
      for (const ref of refs) {
        let n = numberByPmid.get(ref.pmid);
        if (!n) {
          n = references.reduce((max, r) => Math.max(max, r.n), 0) + 1;
          numberByPmid.set(ref.pmid, n);
          references.push({ ...ref, n });
        }
        numbers.push(n);
      }
      if (numbers.length > 0) refsBySlide.set(slideIndex, numbers);
    }

    const slides = deck.slides.map((slide, index) => {
      const refs = refsBySlide.get(index);
      return refs ? { ...slide, refs } : slide;
    });
    await ctx.db.patch(deckId, { references, slides });
  },
});

/** Unchecked read for scheduled work that already ran the ownership check. */
export const load = internalQuery({
  args: { deckId: v.id("decks") },
  handler: async (ctx, { deckId }) => await ctx.db.get(deckId),
});

const column = v.object({
  heading: v.string(),
  bullets: v.array(v.string()),
});

/**
 * Inline text edits from the workspace.
 *
 * Only text fields travel; the mutation merges them into the stored slide so an
 * edit can never drop `imageStorageId`, `refs` or the citation query — the
 * client never sees those in the shape it renders, and sending the whole slide
 * back would silently wipe them.
 *
 * Ownership is by `clientId`, the same anonymous per-browser id the quotas use.
 * It identifies a browser, not a person: enough to stop a stranger with a share
 * link from rewriting someone's deck, not a real permission system.
 */
export const editSlide = mutation({
  args: {
    deckId: v.id("decks"),
    slideIndex: v.number(),
    clientId: v.string(),
    patch: v.object({
      title: v.optional(v.string()),
      subtitle: v.optional(v.string()),
      bullets: v.optional(v.array(v.string())),
      hub: v.optional(v.string()),
      outcome: v.optional(v.string()),
      stat: v.optional(v.object({ value: v.string(), label: v.string() })),
      nodes: v.optional(
        v.array(v.object({ heading: v.string(), body: v.optional(v.string()) })),
      ),
      left: v.optional(column),
      right: v.optional(column),
    }),
  },
  handler: async (ctx, { deckId, slideIndex, clientId, patch }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) throw new Error("Apresentação não encontrada.");
    if (deck.clientId !== clientId) {
      throw new Error("Só quem criou a apresentação pode editá-la.");
    }
    if (deck.status === "gerando") {
      throw new Error("Espere a geração terminar para editar.");
    }
    const current = deck.slides[slideIndex];
    if (!current) throw new Error("Slide inexistente.");

    // Drop empty strings rather than storing them: an emptied title would
    // render as a blank slide with no way back.
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      clean[key] = typeof value === "string" ? value.trim() : value;
    }
    if (Object.keys(clean).length === 0) return;

    const slides = deck.slides.map((slide, i) =>
      i === slideIndex ? { ...slide, ...clean } : slide,
    );
    await ctx.db.patch(deckId, { slides });
  },
});

/** Ownership-checked read used by the AI editor before it changes anything. */
export const loadForEdit = internalQuery({
  args: { deckId: v.id("decks"), clientId: v.string() },
  handler: async (ctx, { deckId, clientId }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) throw new Error("Apresentação não encontrada.");
    if (deck.clientId !== clientId) {
      throw new Error("Só quem criou a apresentação pode editá-la.");
    }
    if (deck.status === "gerando") {
      throw new Error("Espere a geração terminar para editar.");
    }
    return deck;
  },
});
