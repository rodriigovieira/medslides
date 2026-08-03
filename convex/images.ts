import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const stockResult = v.object({
  url: v.string(),
  width: v.number(),
  height: v.number(),
  title: v.string(),
  creator: v.string(),
  sourceUrl: v.string(),
  license: v.string(),
});

export const readCache = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const row = await ctx.db
      .query("imageCache")
      .withIndex("by_query", (q) => q.eq("query", query))
      .unique();
    if (!row) return null;
    if (Date.now() - row.fetchedAt > CACHE_TTL_MS) return null;
    return row.results;
  },
});

export const writeCache = internalMutation({
  args: { query: v.string(), results: v.array(stockResult) },
  handler: async (ctx, { query, results }) => {
    const existing = await ctx.db
      .query("imageCache")
      .withIndex("by_query", (q) => q.eq("query", query))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { results, fetchedAt: Date.now() });
      return;
    }
    await ctx.db.insert("imageCache", { query, results, fetchedAt: Date.now() });
  },
});
