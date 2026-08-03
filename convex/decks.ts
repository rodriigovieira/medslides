import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
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

export const attachImage = internalMutation({
  args: {
    deckId: v.id("decks"),
    slideIndex: v.number(),
    storageId: v.id("_storage"),
    credit: v.optional(v.string()),
  },
  handler: async (ctx, { deckId, slideIndex, storageId, credit }) => {
    const deck = await ctx.db.get(deckId);
    if (!deck) return;
    const slides = deck.slides.map((slide, index) =>
      index === slideIndex
        ? { ...slide, imageStorageId: storageId, imageCredit: credit }
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
      error,
    });
  },
});
