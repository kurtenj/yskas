import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  requestLimits: defineTable({
    kind: v.union(v.literal("pin"), v.literal("provider")),
    windowStart: v.number(), count: v.number(), dayStart: v.number(), dayCount: v.number(),
    leases: v.array(v.object({ id: v.string(), expiresAt: v.number() })),
  }).index("by_kind", ["kind"]),
  users: defineTable({
    name: v.string(),
    dailyCalorieGoal: v.number(),
  }),

  meals: defineTable({
    userId: v.id("users"),
    description: v.string(),
    name: v.string(),
    calories: v.number(),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
    date: v.string(), // YYYY-MM-DD
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_user_date", ["userId", "date"])
    .index("by_user", ["userId"]),
});
