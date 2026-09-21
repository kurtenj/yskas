import { requireIdentity } from "./access";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return await ctx.db.query("users").collect();
  },
});

export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    await requireIdentity(ctx);
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    dailyCalorieGoal: v.number(),
  },
  handler: async (ctx, { name, dailyCalorieGoal }) => {
    await requireIdentity(ctx);
    return await ctx.db.insert("users", { name, dailyCalorieGoal });
  },
});

export const updateGoal = mutation({
  args: {
    id: v.id("users"),
    dailyCalorieGoal: v.number(),
  },
  handler: async (ctx, { id, dailyCalorieGoal }) => {
    await requireIdentity(ctx);
    await ctx.db.patch(id, { dailyCalorieGoal });
  },
});

export const updateName = mutation({
  args: {
    id: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    await requireIdentity(ctx);
    await ctx.db.patch(id, { name });
  },
});
