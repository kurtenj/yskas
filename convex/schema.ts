import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { nutritionFields, provenance } from "./nutritionValidators";

export default defineSchema({
  mealOperations: defineTable({
    operationId: v.string(),
    fingerprint: v.string(),
    userId: v.id("users"),
    date: v.string(),
    mealId: v.id("meals"),
  })
    .index("by_operationId", ["operationId"])
    .index("by_date", ["date"]),
  requestLimits: defineTable({
    kind: v.union(v.literal("pin"), v.literal("provider")),
    windowStart: v.number(),
    count: v.number(),
    dayStart: v.number(),
    dayCount: v.number(),
    leases: v.array(v.object({ id: v.string(), expiresAt: v.number() })),
  }).index("by_kind", ["kind"]),
  users: defineTable({
    name: v.string(),
    dailyCalorieGoal: v.number(),
    dailyProteinGoal: v.optional(v.number()),
    dailyFiberGoal: v.optional(v.number()),
  }),

  meals: defineTable({
    userId: v.id("users"),
    description: v.string(),
    name: v.string(),
    ...nutritionFields,
    provenance: v.optional(provenance),
    loggedAt: v.optional(v.number()),
    date: v.string(), // YYYY-MM-DD
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_user_date", ["userId", "date"])
    .index("by_user", ["userId"]),
});
