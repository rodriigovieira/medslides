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

const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const referenceResult = v.object({
  pmid: v.string(),
  title: v.string(),
  authors: v.string(),
  journal: v.string(),
  year: v.string(),
  url: v.string(),
});

export const readReferenceCache = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const row = await ctx.db
      .query("referenceCache")
      .withIndex("by_query", (q) => q.eq("query", query))
      .unique();
    if (!row) return null;
    if (Date.now() - row.fetchedAt > REF_TTL_MS) return null;
    return row.results;
  },
});

export const writeReferenceCache = internalMutation({
  args: { query: v.string(), results: v.array(referenceResult) },
  handler: async (ctx, { query, results }) => {
    const existing = await ctx.db
      .query("referenceCache")
      .withIndex("by_query", (q) => q.eq("query", query))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { results, fetchedAt: Date.now() });
      return;
    }
    await ctx.db.insert("referenceCache", {
      query,
      results,
      fetchedAt: Date.now(),
    });
  },
});
