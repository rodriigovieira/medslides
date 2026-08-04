import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Storage for the demo deck's generated artwork. Separate from `demoAssets.ts`
 * because that file runs in Node (it calls the image model over fetch) and
 * Convex allows only actions there.
 */
export const read = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const row = await ctx.db
      .query("demoAssets")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    return row?.storageId ?? null;
  },
});

export const write = internalMutation({
  args: { name: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { name, storageId }) => {
    const existing = await ctx.db
      .query("demoAssets")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { storageId, madeAt: Date.now() });
      return;
    }
    await ctx.db.insert("demoAssets", { name, storageId, madeAt: Date.now() });
  },
});

/** Resolves an asset to a URL the slide can carry. */
export const url = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const row = await ctx.db
      .query("demoAssets")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    return row ? await ctx.storage.getUrl(row.storageId) : null;
  },
});
