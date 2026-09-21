import { requireIdentity } from "./access";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";
import { boundedText, positiveGoal } from "../lib/nutrition";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return await ctx.db.query("users").collect();
  },
});

export const get = query({
  // Stored browser selections are untrusted strings, including malformed IDs.
  args: { id: v.string() },
  returns: v.union(schema.doc("users"), v.null()),
  handler: async (ctx, { id }) => {
    await requireIdentity(ctx);
    const normalized = ctx.db.normalizeId("users", id);
    return normalized ? await ctx.db.get(normalized) : null;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    dailyCalorieGoal: v.number(),
  },
  handler: async (ctx, { name, dailyCalorieGoal }) => {
    await requireIdentity(ctx);
    return await ctx.db.insert("users", {
      name: boundedText(name, "Name", 80),
      dailyCalorieGoal: positiveGoal(dailyCalorieGoal),
    });
  },
});

export const updateGoal = mutation({
  args: {
    id: v.id("users"),
    dailyCalorieGoal: v.number(),
    dailyProteinGoal: v.optional(v.union(v.number(), v.null())),
    dailyFiberGoal: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (
    ctx,
    { id, dailyCalorieGoal, dailyProteinGoal, dailyFiberGoal },
  ) => {
    await requireIdentity(ctx);
    await ctx.db.patch(id, {
      dailyCalorieGoal: positiveGoal(dailyCalorieGoal),
      ...(dailyProteinGoal === undefined
        ? {}
        : {
            dailyProteinGoal:
              dailyProteinGoal === null
                ? undefined
                : positiveGoal(dailyProteinGoal),
          }),
      ...(dailyFiberGoal === undefined
        ? {}
        : {
            dailyFiberGoal:
              dailyFiberGoal === null
                ? undefined
                : positiveGoal(dailyFiberGoal),
          }),
    });
  },
});

export const updateName = mutation({
  args: {
    id: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    await requireIdentity(ctx);
    await ctx.db.patch(id, { name: boundedText(name, "Name", 80) });
  },
});
