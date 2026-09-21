/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());

test.each([
  ["2026-03-09T04:30:00Z", "2026-02-23"],
  ["2026-11-02T05:30:00Z", "2026-10-19"],
  ["2027-01-02T05:30:00Z", "2026-12-19"],
])("retains fourteen Chicago dates at %s", async (now, oldestRetained) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { name: "Test", dailyCalorieGoal: 2000 });
    const previous = new Date(`${oldestRetained}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    for (const date of [previous.toISOString().slice(0, 10), oldestRetained]) {
      await ctx.db.insert("meals", { userId, name: "Meal", description: "Meal", calories: 100, date, createdAt: 1 });
    }
  });
  await t.mutation(internal.crons.purgeOldMeals, {});
  await t.run(async ctx => {
    expect((await ctx.db.query("meals").collect()).map(meal => meal.date)).toEqual([oldestRetained]);
  });
});

test.each([0, 99, 100, 101])("%i retained rows terminate without scheduling", async (count) => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Test", dailyCalorieGoal: 2000 });
    for (let i = 0; i < count; i++) {
      await ctx.db.insert("meals", { userId, description: "Meal", name: "Meal", calories: 100, date: "2026-09-14", createdAt: i });
    }
  });
  await t.mutation(internal.crons.purgeOldMeals, { cutoffDate: "2026-09-14" });
  await t.run(async (ctx) => {
    expect((await ctx.db.query("meals").collect()).length).toBe(count);
    expect(await ctx.db.system.query("_scheduled_functions").collect()).toHaveLength(0);
  });
});

test.each([1, 99, 100, 101, 250])("purges %i eligible rows, including backdated rows after retained rows", async (count) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-27T12:00:00Z"));
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Test", dailyCalorieGoal: 2000 });
    for (let i = 0; i < 101 + count; i++) {
      await ctx.db.insert("meals", { userId, description: "Meal", name: "Meal", calories: 100, date: i < 101 ? "2026-09-14" : "2026-09-13", createdAt: i });
    }
  });
  await t.mutation(internal.crons.purgeOldMeals, {});
  // A continuation must retain the original cutoff even across a new day.
  vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  await t.run(async (ctx) => {
    const remaining = await ctx.db.query("meals").collect();
    expect(remaining).toHaveLength(101);
    expect(remaining.every((meal) => meal.date === "2026-09-14")).toBe(true);
  });
});
