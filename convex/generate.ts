"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { sanitizeSlides, slidesNeedingImages } from "../src/lib/deck";
import type { Slide } from "../src/lib/deck";
import { parsePartialDeck } from "../src/lib/partial";
import { generateDeckText } from "./lib/ai";
import {
  FALLBACK_QUERIES,
  creditLine,
  downloadImage,
  isSafeImageQuery,
  normalizeQuery,
  searchStock,
  type StockImage,
} from "./lib/stock";

/** Don't write to the deck more than this often while streaming. */
const PROGRESS_INTERVAL_MS = 500;

export const run = internalAction({
  args: {
    deckId: v.id("decks"),
    topic: v.string(),
    audience: v.string(),
    slideCount: v.number(),
    depth: v.union(v.literal("panorama"), v.literal("aprofundado")),
  },
  handler: async (ctx, { deckId, ...req }) => {
    let lastWriteAt = 0;
    let lastCount = -1;

    const writeProgress = async (text: string, force = false) => {
      const partial = parsePartialDeck(text);
      const slides = sanitizeSlides(partial.slides);
      const now = Date.now();

      // Only worth a write when a new slide finished, and never faster than the
      // interval — the client re-renders on every patch.
      const isNew = slides.length !== lastCount;
      if (!force && (!isNew || now - lastWriteAt < PROGRESS_INTERVAL_MS)) return;

      lastWriteAt = now;
      lastCount = slides.length;
      await ctx.runMutation(internal.decks.applyProgress, {
        deckId,
        title: partial.title ?? "",
        subtitle: partial.subtitle ?? "",
        slides,
      });
    };

    let lastText = "";
    try {
      const { text, provider, model } = await generateDeckText(
        req,
        async (accumulated) => {
          lastText = accumulated;
          await writeProgress(accumulated);
        },
      );

      const parsed = parseFinal(text);
      if (parsed.slides.length === 0) {
        throw new Error("O modelo não retornou nenhum slide.");
      }

      await ctx.runMutation(internal.decks.finish, {
        deckId,
        title: parsed.title,
        subtitle: parsed.subtitle,
        slides: parsed.slides,
        provider,
        model,
      });

      // Images come after the text is committed, so a slow or failing image
      // provider never delays — or breaks — a finished deck.
      await attachImages(ctx, deckId, parsed.slides, req.topic);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao gerar os slides.";

      // Salvage whatever streamed before the failure.
      if (lastText) {
        try {
          await writeProgress(lastText, true);
        } catch {
          // Salvage is best-effort.
        }
      }
      await ctx.runMutation(internal.decks.fail, { deckId, error: message });
      throw error;
    }
  },
});

/**
 * Ops helper: exercises the stock-photo path and reports where it stopped.
 * Image failures are non-fatal by design, which makes them invisible.
 *   npx convex run --prod generate:diagnoseImage '{"query":"hospital corridor"}'
 */
export const diagnoseImage = internalAction({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, { query }) => {
    const q = normalizeQuery(query ?? "hospital corridor");
    const steps: string[] = [`query: ${q}`, `segura: ${isSafeImageQuery(q)}`];
    try {
      const results = await searchStock(q);
      steps.push(`resultados: ${results.length}`);
      if (results[0]) {
        steps.push(`primeira: ${results[0].url}`);
        const file = await downloadImage(results[0].url);
        steps.push(`download: ${file ? `${file.bytes.byteLength} bytes` : "null"}`);
        if (file) {
          const storageId = await ctx.storage.store(
            new Blob([file.bytes], { type: file.contentType }),
          );
          steps.push(`storageId: ${storageId}`);
        }
      }
    } catch (error) {
      steps.push(`ERRO: ${error instanceof Error ? error.stack : String(error)}`);
    }
    return steps;
  },
});

/**
 * Resolves one search through the Convex cache. Openverse allows 200 anonymous
 * requests a day, so a deck must never search once per slide.
 */
async function cachedSearch(
  ctx: ActionCtx,
  rawQuery: string,
): Promise<StockImage[]> {
  const query = normalizeQuery(rawQuery);
  if (!query || !isSafeImageQuery(query)) return [];

  const cached = await ctx.runQuery(internal.images.readCache, { query });
  if (cached) return cached;

  const results = await searchStock(query);
  // Cache misses too: a query that found nothing shouldn't be retried by every
  // later deck on the same topic.
  await ctx.runMutation(internal.images.writeCache, { query, results });
  return results;
}

async function attachImages(
  ctx: ActionCtx,
  deckId: Id<"decks">,
  slides: Slide[],
  topic: string,
) {
  const targets = slidesNeedingImages(slides);
  if (targets.length === 0) return;

  // One search per distinct query, then a widening set of fallbacks so a niche
  // topic still ends up with something rather than a bare slide.
  const queries = [
    ...new Set(targets.map((i) => slides[i].imageQuery ?? "").filter(Boolean)),
  ];
  const pools = new Map<string, StockImage[]>();
  for (const query of queries) {
    pools.set(query, await cachedSearch(ctx, query));
  }

  // StockSnap is curated, so a single query often yields only a handful of
  // usable photos — and the dedupe below drains that fast. Always build the
  // shared fallback pool; the cache makes it nearly free after the first deck.
  const fallback: StockImage[] = [];
  for (const query of [topic, ...FALLBACK_QUERIES]) {
    if (fallback.length >= targets.length * 3) break;
    fallback.push(...(await cachedSearch(ctx, query)));
  }

  // Don't repeat a photo inside one deck — the same corridor twice reads as a
  // bug even when each slide picked it independently.
  const used = new Set<string>();
  const pick = (query: string): StockImage | null => {
    for (const pool of [pools.get(query) ?? [], fallback]) {
      const found = pool.find((image) => !used.has(image.url));
      if (found) {
        used.add(found.url);
        return found;
      }
    }
    return null;
  };

  for (const slideIndex of targets) {
    const image = pick(slides[slideIndex].imageQuery ?? "");
    if (!image) continue;
    try {
      const file = await downloadImage(image.url);
      if (!file) continue;
      const storageId = await ctx.storage.store(
        new Blob([file.bytes], { type: file.contentType }),
      );
      await ctx.runMutation(internal.decks.attachImage, {
        deckId,
        slideIndex,
        storageId,
        credit: creditLine(image),
      });
    } catch (error) {
      console.warn(`Imagem do slide ${slideIndex} falhou: ${String(error)}`);
    }
  }
}

function parseFinal(text: string) {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    return {
      title: typeof raw.title === "string" ? raw.title : "Apresentação",
      subtitle: typeof raw.subtitle === "string" ? raw.subtitle : "",
      slides: sanitizeSlides(
        Array.isArray(raw.slides) ? (raw.slides as unknown[]) : [],
      ),
    };
  } catch {
    // Truncated output — keep the slides that did close.
    const partial = parsePartialDeck(text);
    return {
      title: partial.title ?? "Apresentação",
      subtitle: partial.subtitle ?? "",
      slides: sanitizeSlides(partial.slides),
    };
  }
}
