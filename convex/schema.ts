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
    v.literal("mecanismo"),
    v.literal("fluxo"),
    v.literal("cards"),
  ),
  title: v.string(),
  subtitle: v.optional(v.string()),
  bullets: v.optional(v.array(v.string())),
  left: v.optional(column),
  right: v.optional(column),
  stat: v.optional(v.object({ value: v.string(), label: v.string() })),
  // Diagram layouts: hub + nodes + outcome.
  hub: v.optional(v.string()),
  nodes: v.optional(
    v.array(
      v.object({ heading: v.string(), body: v.optional(v.string()) }),
    ),
  ),
  outcome: v.optional(v.string()),
  notes: v.optional(v.string()),
  source: v.optional(v.string()),
  // Claim to verify against PubMed, and the resulting reference numbers.
  citationQuery: v.optional(v.string()),
  refs: v.optional(v.array(v.number())),
  // Short English search terms for stock photography.
  imageQuery: v.optional(v.string()),
  imageCredit: v.optional(v.string()),
  /**
   * The stock photo this came from. Kept as the photo's identity: the credit
   * line names the *photographer*, who usually has several photos in the pool,
   * so it can't answer "is this the same picture the cover already used?" — the
   * question a slide enriched later has to ask.
   */
  imageSource: v.optional(v.string()),
  /**
   * "ilustracao" when the picture is drawn rather than photographed. It changes
   * how the slide uses it: an illustration on white can never go under the dark
   * full-bleed scrim, which would bury it.
   */
  imageStyle: v.optional(v.string()),
  /**
   * Legacy: decks generated before the switch from AI image generation to stock
   * photography carry this. Nothing writes it any more, but removing it from the
   * validator would fail the schema push against those existing rows.
   */
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
    /**
     * Finer-grained progress than `status`. Text finishes long before the deck
     * does — references and images land afterwards — so `status: "pronto"` on
     * its own told the user it was finished while work was still running.
     */
    phase: v.optional(
      v.union(
        v.literal("texto"),
        v.literal("referencias"),
        v.literal("imagens"),
        v.literal("pronto"),
      ),
    ),
    error: v.optional(v.string()),

    // Which provider actually produced the deck — Gemini normally, OpenAI when
    // Gemini rate-limits or errors.
    provider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
    model: v.optional(v.string()),

    // Deck-wide bibliography. Every entry came back from PubMed with a real
    // PMID — nothing here is model-authored.
    references: v.optional(
      v.array(
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
    ),

    /** Conversation with the AI editor, oldest first. */
    chat: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          text: v.string(),
          at: v.number(),
        }),
      ),
    ),

    clientId: v.string(),
    createdAt: v.number(),
  })
    .index("by_client", ["clientId", "createdAt"])
    .index("by_created", ["createdAt"]),

  // Openverse allows 200 anonymous requests/day, well under our deck ceiling,
  // so every search is cached by normalized query and reused across decks.
  imageCache: defineTable({
    query: v.string(),
    results: v.array(
      v.object({
        url: v.string(),
        width: v.number(),
        height: v.number(),
        title: v.string(),
        creator: v.string(),
        sourceUrl: v.string(),
        license: v.string(),
      }),
    ),
    fetchedAt: v.number(),
  }).index("by_query", ["query"]),

  // PubMed allows 3 requests/second anonymously, so verified references are
  // cached by normalized claim and reused across decks.
  referenceCache: defineTable({
    query: v.string(),
    results: v.array(
      v.object({
        pmid: v.string(),
        title: v.string(),
        authors: v.string(),
        journal: v.string(),
        year: v.string(),
        url: v.string(),
      }),
    ),
    fetchedAt: v.number(),
  }).index("by_query", ["query"]),

  // Anonymous product, so the only spend guards are a per-browser quota and a
  // global daily ceiling. Both are best-effort: clientId is client-generated.
  usage: defineTable({
    scope: v.string(), // "global" or a clientId
    windowStart: v.number(),
    count: v.number(),
  }).index("by_scope", ["scope"]),
});
