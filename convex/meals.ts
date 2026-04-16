import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const forDate = query({
  args: {
    userId: v.id("users"),
    date: v.string(),
  },
  handler: async (ctx, { userId, date }) => {
    return await ctx.db
      .query("meals")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("date", date)
      )
      .order("asc")
      .collect();
  },
});

export const forDateRange = query({
  args: {
    userId: v.id("users"),
    dates: v.array(v.string()),
  },
  handler: async (ctx, { userId, dates }) => {
    const all = await ctx.db
      .query("meals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return all.filter((m) => dates.includes(m.date));
  },
});

export const add = mutation({
  args: {
    userId: v.id("users"),
    description: v.string(),
    name: v.string(),
    calories: v.number(),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("meals", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("meals") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
