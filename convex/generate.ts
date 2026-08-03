"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { sanitizeSlides, slidesNeedingImages } from "../src/lib/deck";
import type { Slide } from "../src/lib/deck";
import { parsePartialDeck } from "../src/lib/partial";
import { generateDeckText } from "./lib/ai";
import { generateImage, isSafeImagePrompt } from "./lib/images";

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
      await attachImages(ctx, deckId, parsed.slides);
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
 * Ops helper: exercises the image path end to end and returns what happened.
 * Image failures are deliberately non-fatal in `run`, which makes them
 * invisible — this is how you find out why a deck came back without art.
 *   npx convex run --prod generate:diagnoseImage '{}'
 */
export const diagnoseImage = internalAction({
  args: { prompt: v.optional(v.string()) },
  handler: async (ctx, { prompt }) => {
    const test =
      prompt ?? "empty hospital corridor at night, cool light, editorial";
    const steps: string[] = [];
    steps.push(`FAL_KEY presente: ${Boolean(process.env.FAL_KEY)}`);
    steps.push(`prompt seguro: ${isSafeImagePrompt(test)}`);

    try {
      const image = await generateImage(test);
      steps.push(`imagem gerada: ${image ? `${image.bytes.byteLength} bytes` : "null"}`);
      if (image) {
        const storageId = await ctx.storage.store(
          new Blob([image.bytes], { type: image.contentType }),
        );
        steps.push(`storageId: ${storageId}`);
      }
    } catch (error) {
      steps.push(`ERRO: ${error instanceof Error ? error.stack : String(error)}`);
    }
    return steps;
  },
});

async function attachImages(
  ctx: ActionCtx,
  deckId: Id<"decks">,
  slides: Slide[],
) {
  const targets = slidesNeedingImages(slides);
  if (targets.length === 0) return;

  await Promise.all(
    targets.map(async (slideIndex) => {
      const prompt = slides[slideIndex]?.imagePrompt;
      if (!prompt) return;
      try {
        const image = await generateImage(prompt);
        if (!image) return;
        const storageId = await ctx.storage.store(
          new Blob([image.bytes], { type: image.contentType }),
        );
        await ctx.runMutation(internal.decks.attachImage, {
          deckId,
          slideIndex,
          storageId,
        });
      } catch (error) {
        console.warn(`Imagem do slide ${slideIndex} falhou: ${String(error)}`);
      }
    }),
  );
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
