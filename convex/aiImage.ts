"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { AI_CREDIT } from "../src/lib/deck";
import {
  ImageError,
  generateSlideImage,
  type ImageQuality,
} from "./lib/imagen";

/**
 * Generates one slide image and attaches it.
 *
 * Scheduled rather than awaited by the caller: the model takes ten seconds or
 * so, which is a long time to hold a chat spinner, and the slide is already on
 * screen — the picture arrives on it through the same live query that drew it.
 *
 * The budget is reserved by the caller *before* this is scheduled. Doing it here
 * would mean the spend has already happened by the time the limit is consulted.
 */
export const run = internalAction({
  args: {
    deckId: v.id("decks"),
    slideIndex: v.number(),
    prompt: v.string(),
    quality: v.union(v.literal("rapida"), v.literal("alta")),
  },
  handler: async (ctx, { deckId, slideIndex, prompt, quality }) => {
    try {
      const image = await generateSlideImage(prompt, quality as ImageQuality);
      const storageId = await ctx.storage.store(
        new Blob([image.bytes], { type: image.contentType }),
      );
      await ctx.runMutation(internal.decks.attachImage, {
        deckId,
        slideIndex,
        storageId,
        credit: AI_CREDIT,
        // Marks the slide as carrying generated art rather than a photograph,
        // and doubles as the identity that keeps the picker from reusing it.
        source: `ia:${image.model}:${prompt.slice(0, 80)}`,
      });
    } catch (error) {
      // The user is waiting on a promise the chat already made, so a failure has
      // to come back to them in the same place. Silence would read as the
      // feature being broken rather than the request being refused.
      const detail =
        error instanceof ImageError
          ? error.message
          : `Não consegui gerar a imagem do slide ${slideIndex + 1}.`;
      console.warn(`Imagem IA falhou: ${String(error)}`);
      await ctx.runMutation(internal.chatOps.appendMessage, {
        deckId,
        role: "assistant",
        text: detail,
      });
    }
  },
});
