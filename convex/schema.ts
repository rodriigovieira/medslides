import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const column = v.object({
  heading: v.string(),
  bullets: v.array(v.string()),
});

export const slideValidator = v.object({
  layout: v.union(
    v.literal("capa"),
    v.literal("secao"),
    v.literal("topicos"),
    v.literal("destaque"),
    v.literal("comparacao"),
    v.literal("encerramento"),
  ),
  title: v.string(),
  subtitle: v.optional(v.string()),
  bullets: v.optional(v.array(v.string())),
  left: v.optional(column),
  right: v.optional(column),
  stat: v.optional(v.object({ value: v.string(), label: v.string() })),
  notes: v.optional(v.string()),
  source: v.optional(v.string()),
  imagePrompt: v.optional(v.string()),
  // Stored in Convex file storage; `decks.get` resolves it to a URL so the
  // client and the .pptx exporter never deal with storage ids.
  imageStorageId: v.optional(v.id("_storage")),
});

export default defineSchema({
  decks: defineTable({
    topic: v.string(),
    audience: v.string(),
    slideCount: v.number(),
    depth: v.union(v.literal("panorama"), v.literal("aprofundado")),

    title: v.string(),
    subtitle: v.string(),
    slides: v.array(slideValidator),

    status: v.union(
      v.literal("gerando"),
      v.literal("pronto"),
      v.literal("erro"),
    ),
    error: v.optional(v.string()),

    // Which provider actually produced the deck — Gemini normally, OpenAI when
    // Gemini rate-limits or errors.
    provider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
    model: v.optional(v.string()),

    clientId: v.string(),
    createdAt: v.number(),
  })
    .index("by_client", ["clientId", "createdAt"])
    .index("by_created", ["createdAt"]),

  // Anonymous product, so the only spend guards are a per-browser quota and a
  // global daily ceiling. Both are best-effort: clientId is client-generated.
  usage: defineTable({
    scope: v.string(), // "global" or a clientId
    windowStart: v.number(),
    count: v.number(),
  }).index("by_scope", ["scope"]),
});
