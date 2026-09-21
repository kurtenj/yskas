/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { nutritionTotals } from "../lib/nutrition";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.stubEnv("AUTH_ISSUER", "https://yskas.test");
  vi.stubEnv("AUTH_SESSION_VERSION", "1");
});
afterEach(() => vi.unstubAllEnvs());
async function setup() {
  const t = convexTest(schema, modules);
  const h = t.withIdentity({
    issuer: "https://yskas.test",
    subject: "household",
    tokenIdentifier: "https://yskas.test|household",
    sessionVersion: "1",
  });
  const userId = await h.mutation(api.users.create, {
    name: "Test",
    dailyCalorieGoal: 2000,
  });
  return { t, h, userId };
}
test("recent candidates exclude backlog, other profiles, gaps, and duplicate dates", async () => {
  const { t, h, userId } = await setup();
  const other = await h.mutation(api.users.create, {
    name: "Other",
    dailyCalorieGoal: 2000,
  });
  await t.run(async (ctx) => {
    for (let i = 0; i < 500; i++)
      await ctx.db.insert("meals", {
        userId,
        name: "Backlog",
        description: "old",
        date: "2026-08-01",
        calories: 1,
        createdAt: i,
      });
    for (const date of ["2026-09-19", "2026-09-20", "2026-09-21"]) {
      await ctx.db.insert("meals", {
        userId,
        name: date,
        description: "recent",
        date,
        calories: 10,
        createdAt: 1000,
      });
      await ctx.db.insert("meals", {
        userId: other,
        name: "Other",
        description: "other",
        date,
        calories: 20,
        createdAt: 1000,
      });
    }
  });
  const meals = await h.query(api.meals.forDateRange, {
    userId,
    dates: ["2026-09-19", "2026-09-21", "2026-09-19"],
  });
  expect(meals.map((m) => m.date)).toEqual(["2026-09-21", "2026-09-19"]);
  expect(await h.query(api.meals.forDateRange, { userId, dates: [] })).toEqual(
    [],
  );
});
test("suggestion candidate cap does not truncate daily nutrition totals", async () => {
  const { t, h, userId } = await setup();
  await t.run(async (ctx) => {
    for (let i = 0; i < 125; i++)
      await ctx.db.insert("meals", {
        userId,
        name: `Meal ${i}`,
        description: "meal",
        date: "2026-09-21",
        calories: 10,
        protein: 1,
        fiber: 0.5,
        createdAt: i,
      });
  });
  const args = { userId, dates: ["2026-09-21"] };
  const recent = await h.query(api.meals.forDateRange, args);
  expect(recent).toHaveLength(100);
  expect(await h.query(api.meals.forDateRange, args)).toEqual(recent);
  const daily = await h.query(api.meals.forDate, {
    userId,
    date: args.dates[0],
  });
  expect(daily).toHaveLength(125);
  expect(nutritionTotals(daily)).toMatchObject({
    calories: 1250,
    protein: { grams: 125 },
    fiber: { grams: 62.5 },
  });
});
test("date windows reject invalid dates, excessive size and excessive span", async () => {
  const { h, userId } = await setup();
  for (const dates of [
    ["2026-02-30"],
    ["2026-08-01", "2026-09-21"],
    Array(15).fill("2026-09-21"),
  ])
    await expect(
      h.query(api.meals.forDateRange, { userId, dates }),
    ).rejects.toThrow();
});
test("selected-profile lookup safely handles malformed, wrong-table and deleted IDs", async () => {
  const { t, h, userId } = await setup();
  expect((await h.query(api.users.get, { id: userId }))?._id).toBe(userId);
  for (const id of ["", "garbage", "null"])
    expect(await h.query(api.users.get, { id })).toBeNull();
  const mealId = await t.run((ctx) =>
    ctx.db.insert("meals", {
      userId,
      name: "Meal",
      description: "meal",
      date: "2026-09-21",
      calories: 10,
      createdAt: 1,
    }),
  );
  expect(await h.query(api.users.get, { id: mealId })).toBeNull();
  await t.run((ctx) => ctx.db.delete(userId));
  expect(await h.query(api.users.get, { id: userId })).toBeNull();
});
