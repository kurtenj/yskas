import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const purgeOldMeals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

    const batch = await ctx.db.query("meals").take(100);
    const toDelete = batch.filter((m) => m.date < cutoffDate);
    for (const meal of toDelete) {
      await ctx.db.delete(meal._id);
    }

    if (batch.length === 100) {
      await ctx.scheduler.runAfter(0, internal.crons.purgeOldMeals, {});
    }
  },
});

const crons = cronJobs();

crons.cron("purge old meals", "0 0 * * *", internal.crons.purgeOldMeals, {});

export default crons;
