import { v } from "convex/values";
export const nutritionFields = {
  calories: v.number(),
  protein: v.optional(v.number()),
  fiber: v.optional(v.number()),
  carbs: v.optional(v.number()),
  fat: v.optional(v.number()),
};
export const estimateMetadata = v.object({
  model: v.string(),
  promptVersion: v.string(),
  schemaVersion: v.number(),
});
export const provenance = v.object({
  kind: v.union(
    v.literal("estimate"),
    v.literal("unknown"),
    v.literal("reuse"),
    v.literal("legacy"),
  ),
  originalNutrition: v.object(nutritionFields),
  estimate: v.optional(estimateMetadata),
  sourceMealId: v.optional(v.id("meals")),
  servingMultiplier: v.number(),
});
const optionalCorrection = v.optional(v.union(v.number(), v.null()));
export const correction = v.object({
  calories: v.optional(v.number()),
  protein: optionalCorrection,
  fiber: optionalCorrection,
  carbs: optionalCorrection,
  fat: optionalCorrection,
});
