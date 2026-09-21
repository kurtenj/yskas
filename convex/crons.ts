import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { offsetDate, todayDate } from "../lib/dates";

export const purgeOldMeals = internalMutation({
  args: { cutoffDate: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Retain today plus the preceding 13 Chicago calendar days.
    const cutoffDate = args.cutoffDate ?? offsetDate(todayDate(), -13);

    const batch = await ctx.db
      .query("meals")
      .withIndex("by_date", (q) => q.lt("date", cutoffDate))
      .take(100);
    for (const meal of batch) {
      await ctx.db.delete(meal._id);
    }

    const operations = await ctx.db
      .query("mealOperations")
      .withIndex("by_date", (q) => q.lt("date", cutoffDate))
      .take(100);
    for (const operation of operations) await ctx.db.delete(operation._id);

    if (batch.length === 100 || operations.length === 100) {
      await ctx.scheduler.runAfter(0, internal.crons.purgeOldMeals, {
        cutoffDate,
      });
    }
    return null;
  },
});

const crons = cronJobs();

crons.cron("purge old meals", "0 0 * * *", internal.crons.purgeOldMeals, {});

export default crons;
