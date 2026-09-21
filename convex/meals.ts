import { requireIdentity } from "./access";
import { prepareOperation, finishOperation } from "./mealOperations";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  nutritionFields,
  estimateMetadata,
  correction,
} from "./nutritionValidators";
import {
  boundedText,
  correctNutrition,
  nonnegative,
  parseNutrition,
  positiveGoal,
  scaleNutrition,
} from "../lib/nutrition";
import { formatDateKey, validateDateKey } from "../lib/dates";

function loggingFields(date: string, loggedAt?: number) {
  validateDateKey(date);
  if (loggedAt !== undefined) {
    nonnegative(loggedAt, "Logging time");
    if (formatDateKey(new Date(loggedAt)) !== date)
      throw new Error("Logging time and date disagree.");
  }
  return { date, ...(loggedAt === undefined ? {} : { loggedAt }) };
}

export const forDate = query({
  args: {
    userId: v.id("users"),
    date: v.string(),
  },
  handler: async (ctx, { userId, date }) => {
    await requireIdentity(ctx);
    validateDateKey(date);
    return await ctx.db
      .query("meals")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
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
    await requireIdentity(ctx);
    if (dates.length > 14)
      throw new Error("Date window cannot exceed 14 days.");
    dates.forEach(validateDateKey);
    const all = await ctx.db
      .query("meals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return all.filter((m) => dates.includes(m.date));
  },
});

export const add = mutation({
  args: {
    operationId: v.optional(v.string()),
    userId: v.id("users"),
    description: v.string(),
    name: v.string(),
    ...nutritionFields,
    originalNutrition: v.optional(v.object(nutritionFields)),
    estimate: v.optional(estimateMetadata),
    loggedAt: v.optional(v.number()),
    date: v.string(),
  },
  returns: v.id("meals"),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    if (!(await ctx.db.get(args.userId)))
      throw new Error("Profile no longer exists.");
    const nutrition = parseNutrition(args);
    const originalNutrition = args.originalNutrition
      ? parseNutrition(args.originalNutrition)
      : nutrition;
    const estimate = args.estimate
      ? {
          model: boundedText(args.estimate.model, "Model", 100),
          promptVersion: boundedText(
            args.estimate.promptVersion,
            "Prompt version",
            100,
          ),
          schemaVersion: nonnegative(
            args.estimate.schemaVersion,
            "Schema version",
          ),
        }
      : undefined;
    const name = boundedText(args.name, "Meal name", 120);
    const description = boundedText(args.description, "Description", 2000);
    const logging = loggingFields(args.date, args.loggedAt);
    const operation = await prepareOperation(ctx, "add", args);
    if (operation?.previous) return operation.previous.mealId;
    const mealId = await ctx.db.insert("meals", {
      userId: args.userId,
      name,
      description,
      ...nutrition,
      ...logging,
      provenance: {
        kind: estimate ? "estimate" : "unknown",
        originalNutrition,
        servingMultiplier: 1,
        ...(estimate ? { estimate } : {}),
      },
      createdAt: Date.now(),
    });
    return finishOperation(ctx, operation, args.userId, args.date, mealId);
  },
});

export const reuse = mutation({
  args: {
    operationId: v.optional(v.string()),
    sourceId: v.id("meals"),
    userId: v.id("users"),
    date: v.string(),
    loggedAt: v.number(),
    factor: v.optional(v.number()),
    correction: v.optional(correction),
  },
  returns: v.id("meals"),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    loggingFields(args.date, args.loggedAt);
    if (!(await ctx.db.get(args.userId)))
      throw new Error("Profile no longer exists.");
    const operation = await prepareOperation(ctx, "reuse", args);
    if (operation?.previous) return operation.previous.mealId;
    const source = await ctx.db.get(args.sourceId);
    if (!source || source.userId !== args.userId)
      throw new Error("Source meal is no longer available for this profile.");
    if (!(await ctx.db.get(args.userId)))
      throw new Error("Profile no longer exists.");
    const factor = args.factor ?? 1;
    const nutrition = correctNutrition(
      scaleNutrition(source, factor),
      args.correction ?? {},
    );
    const multiplier = (source.provenance?.servingMultiplier ?? 1) * factor;
    // The snapshot survives deletion of the source by retention cleanup.
    const mealId = await ctx.db.insert("meals", {
      userId: args.userId,
      name: source.name,
      description: source.description,
      ...nutrition,
      ...loggingFields(args.date, args.loggedAt),
      createdAt: Date.now(),
      provenance: {
        kind: "reuse",
        originalNutrition:
          source.provenance?.originalNutrition ?? parseNutrition(source),
        servingMultiplier: positiveGoal(multiplier),
        sourceMealId: source._id,
        ...(source.provenance?.estimate
          ? { estimate: source.provenance.estimate }
          : {}),
      },
    });
    return finishOperation(ctx, operation, args.userId, args.date, mealId);
  },
});

export const updateNutrition = mutation({
  args: { id: v.id("meals"), correction },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const meal = await ctx.db.get(args.id);
    if (!meal) throw new Error("Meal no longer exists.");
    const nutrition = correctNutrition(meal, args.correction);
    await ctx.db.patch(args.id, {
      ...nutrition,
      // Explicit undefined removes an optional nutrient cleared by the user.
      protein: nutrition.protein,
      fiber: nutrition.fiber,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
      provenance: meal.provenance ?? {
        kind: "legacy",
        originalNutrition: parseNutrition(meal),
        servingMultiplier: 1,
      },
    });
  },
});

export const remove = mutation({
  args: { id: v.id("meals") },
  handler: async (ctx, { id }) => {
    await requireIdentity(ctx);
    await ctx.db.delete(id);
  },
});
