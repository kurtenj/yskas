/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { ESTIMATE_VERSION, nutritionTotals } from "../lib/nutrition";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.stubEnv("AUTH_ISSUER", "https://yskas.test");
  vi.stubEnv("AUTH_SESSION_VERSION", "1");
});
afterEach(() => vi.unstubAllEnvs());
async function setup() {
  const t = convexTest(schema, modules);
  const household = t.withIdentity({
    issuer: "https://yskas.test",
    subject: "household",
    tokenIdentifier: "https://yskas.test|household",
    sessionVersion: "1",
  });
  const userId = await household.mutation(api.users.create, {
    name: "Household",
    dailyCalorieGoal: 1800,
  });
  return { t, household, userId };
}
const logging = {
  date: "2026-09-21",
  loggedAt: Date.parse("2026-09-22T04:59:00Z"),
};
test("legacy meals stay unknown and new fiber/decimals/provenance survive save and read", async () => {
  const { t, household, userId } = await setup();
  await t.run((ctx) =>
    ctx.db.insert("meals", {
      userId,
      name: "Old",
      description: "old",
      calories: 100,
      date: logging.date,
      createdAt: 1,
    }),
  );
  await household.mutation(api.meals.add, {
    userId,
    name: "Beans",
    description: "one cup of beans",
    calories: 200.5,
    protein: 12.2,
    fiber: 8.7,
    estimate: ESTIMATE_VERSION,
    ...logging,
  });
  const meals = await household.query(api.meals.forDate, {
    userId,
    date: logging.date,
  });
  expect(meals[0].fiber).toBeUndefined();
  expect(meals[0].provenance).toBeUndefined();
  expect(meals[1]).toMatchObject({
    fiber: 8.7,
    calories: 200.5,
    loggedAt: logging.loggedAt,
    provenance: {
      originalNutrition: { calories: 200.5, fiber: 8.7 },
      estimate: ESTIMATE_VERSION,
    },
  });
  expect(nutritionTotals(meals).fiber).toEqual({ grams: 8.7, missing: 1 });
});
test("correction keeps the original snapshot, other macros, and unknown clearing semantics", async () => {
  const { household, userId } = await setup();
  const id = await household.mutation(api.meals.add, {
    userId,
    name: "Beans",
    description: "one cup beans",
    calories: 200,
    protein: 12,
    fiber: 8,
    ...logging,
  });
  await household.mutation(api.meals.updateNutrition, {
    id,
    correction: { calories: 210 },
  });
  await household.mutation(api.meals.updateNutrition, {
    id,
    correction: { fiber: null },
  });
  const [meal] = await household.query(api.meals.forDate, {
    userId,
    date: logging.date,
  });
  expect(meal).toMatchObject({
    calories: 210,
    protein: 12,
    provenance: { originalNutrition: { calories: 200, protein: 12, fiber: 8 } },
  });
  expect(meal.fiber).toBeUndefined();
});
test("reuse/scaling preserve source context and snapshots after the original is deleted", async () => {
  const { household, userId } = await setup();
  const sourceId = await household.mutation(api.meals.add, {
    userId,
    name: "Eggs",
    description: "one boiled egg",
    calories: 70,
    protein: 6,
    estimate: ESTIMATE_VERSION,
    ...logging,
  });
  await household.mutation(api.meals.reuse, {
    sourceId,
    userId,
    factor: 2,
    ...logging,
  });
  await household.mutation(api.meals.remove, { id: sourceId });
  const [meal] = await household.query(api.meals.forDate, {
    userId,
    date: logging.date,
  });
  expect(meal).toMatchObject({
    description: "one boiled egg",
    calories: 140,
    protein: 12,
    provenance: {
      sourceMealId: sourceId,
      servingMultiplier: 2,
      originalNutrition: { calories: 70 },
      estimate: ESTIMATE_VERSION,
    },
  });
  expect(meal.fiber).toBeUndefined();
  await expect(
    household.mutation(api.meals.reuse, { sourceId, userId, ...logging }),
  ).rejects.toThrow("no longer available");
});
test("goals validate on the server and support independent optional targets and removal", async () => {
  const { household, userId } = await setup();
  await household.mutation(api.users.updateGoal, {
    id: userId,
    dailyCalorieGoal: 1800,
    dailyProteinGoal: 120.5,
    dailyFiberGoal: 25,
  });
  await household.mutation(api.users.updateGoal, {
    id: userId,
    dailyCalorieGoal: 1900,
    dailyFiberGoal: null,
  });
  const user = await household.query(api.users.get, { id: userId });
  expect(user).toMatchObject({
    dailyCalorieGoal: 1900,
    dailyProteinGoal: 120.5,
  });
  expect(user?.dailyFiberGoal).toBeUndefined();
  for (const dailyFiberGoal of [0, -2, NaN, Infinity])
    await expect(
      household.mutation(api.users.updateGoal, {
        id: userId,
        dailyCalorieGoal: 1800,
        dailyFiberGoal,
      }),
    ).rejects.toThrow();
});
test("manual/direct writes reject invalid values, dates, descriptions and orphaned profiles", async () => {
  const { t, household, userId } = await setup();
  const base = {
    userId,
    name: "Beans",
    description: "one cup",
    calories: 200,
    ...logging,
  };
  for (const patch of [
    { fiber: -1 },
    { protein: Infinity },
    { calories: NaN },
    { name: " " },
    { description: " " },
    { date: "2026-02-30" },
    { date: "2026-09-22" },
  ])
    await expect(
      household.mutation(api.meals.add, { ...base, ...patch }),
    ).rejects.toThrow();
  await t.run((ctx) => ctx.db.delete(userId));
  await expect(household.mutation(api.meals.add, base)).rejects.toThrow(
    "Profile no longer exists",
  );
});
