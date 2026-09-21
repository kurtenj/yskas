import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const purgeOldMeals = internalMutation({
  args: { cutoffDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Retain today plus the preceding 13 Chicago calendar days.
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const cutoff = new Date(`${today}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 13);
    const cutoffDate = args.cutoffDate ?? cutoff.toISOString().slice(0, 10);

    const batch = await ctx.db.query("meals")
      .withIndex("by_date", (q) => q.lt("date", cutoffDate))
      .take(100);
    for (const meal of batch) {
      await ctx.db.delete(meal._id);
    }

    if (batch.length === 100) {
      await ctx.scheduler.runAfter(0, internal.crons.purgeOldMeals, { cutoffDate });
    }
  },
});

const crons = cronJobs();

crons.cron("purge old meals", "0 0 * * *", internal.crons.purgeOldMeals, {});

export default crons;
