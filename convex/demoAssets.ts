"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { generateSlideImage } from "./lib/imagen";

/**
 * The demo deck's artwork, generated once and reused forever.
 *
 * The showcase is opened by a salesperson in front of a customer, possibly many
 * times a day. Generating its illustration on each click would be about ten
 * seconds of waiting and a few cents of spend, every time, for an image that is
 * identical every time — and it would eat the same daily budget that protects
 * real users.
 *
 * So it is generated on the first demo that needs it and then cached in
 * `demoAssets` by name. Every later demo reads the stored file. The cost of the
 * whole feature, forever, is one image per asset — unless someone deliberately
 * regenerates:
 *
 *   npx convex run --prod demoAssets:ensure '{"name":"coracao","force":true}'
 */

/**
 * Art direction lives here rather than in the deck, because it is a property of
 * the *asset*, not of the slide that shows it. The palette matches the deck's
 * own tokens so the heart reads as drawn for this design rather than dropped in.
 */
const PROMPTS: Record<string, string> = {
  coracao: [
    "An anatomically faithful human heart, drawn as a clean scientific",
    "illustration: aorta, pulmonary artery, atria and ventricles clearly formed,",
    "coronary vessels traced across the surface.",
    "Deep teal as the primary tone with muted plum for the vessels, soft internal",
    "shading, confident line work, viewed from the front, upright, centred.",
  ].join(" "),
};

export const ensure = internalAction({
  args: { name: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, { name, force }): Promise<string | null> => {
    if (!force) {
      const existing = await ctx.runQuery(internal.demoAssetStore.read, { name });
      if (existing) return existing;
    }

    const prompt = PROMPTS[name];
    if (!prompt) throw new Error(`Sem prompt para o asset "${name}".`);

    try {
      // `alta` on purpose: this is generated once in the product's whole life
      // and shown to every prospect, so it is the one place where the more
      // expensive model is obviously worth it.
      const image = await generateSlideImage(prompt, "alta", "ilustracao");
      const storageId = await ctx.storage.store(
        new Blob([image.bytes], { type: image.contentType }),
      );
      await ctx.runMutation(internal.demoAssetStore.write, { name, storageId });
      return storageId;
    } catch (error) {
      // The demo must open with or without its artwork. A missing illustration
      // costs the deck one slide's impact; a demo that fails to open in front of
      // a customer costs the sale.
      console.warn(`Asset "${name}" falhou: ${String(error)}`);
      return null;
    }
  },
});
