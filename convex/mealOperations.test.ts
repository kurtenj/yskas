/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { todayDate, offsetDate } from "../lib/dates";
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
  const args = {
    userId,
    operationId: crypto.randomUUID(),
    date: todayDate(),
    name: "Beans",
    description: "beans",
    calories: 200,
    fiber: 8.7,
  };
  return { t, h, args };
}
test("concurrent retries return one stable result; intentional repeat creates another", async () => {
  const { h, args } = await setup();
  const ids = await Promise.all([
    h.mutation(api.meals.add, args),
    h.mutation(api.meals.add, args),
  ]);
  expect(ids[0]).toBe(ids[1]);
  expect(
    await h.mutation(api.meals.add, {
      ...args,
      operationId: crypto.randomUUID(),
    }),
  ).not.toBe(ids[0]);
  expect(
    await h.query(api.meals.forDate, { userId: args.userId, date: args.date }),
  ).toHaveLength(2);
});
test("replays cannot change nutrition or profile; validation still runs", async () => {
  const { h, args } = await setup();
  await h.mutation(api.meals.add, args);
  await expect(
    h.mutation(api.meals.add, { ...args, calories: 300 }),
  ).rejects.toThrow("different submission");
  await expect(
    h.mutation(api.meals.add, { ...args, fiber: -1 }),
  ).rejects.toThrow();
  const userId = await h.mutation(api.users.create, {
    name: "Other",
    dailyCalorieGoal: 2000,
  });
  await expect(h.mutation(api.meals.add, { ...args, userId })).rejects.toThrow(
    "different submission",
  );
});
test("deleted meals are not resurrected by retries, including reuse after source deletion", async () => {
  const { h, args } = await setup();
  const sourceId = await h.mutation(api.meals.add, args);
  const reuse = {
    userId: args.userId,
    sourceId,
    date: args.date,
    loggedAt: Date.now(),
    operationId: crypto.randomUUID(),
  };
  const copied = await h.mutation(api.meals.reuse, reuse);
  await h.mutation(api.meals.remove, { id: sourceId });
  await h.mutation(api.meals.remove, { id: copied });
  expect(await h.mutation(api.meals.add, args)).toBe(sourceId);
  expect(await h.mutation(api.meals.reuse, reuse)).toBe(copied);
  expect(
    await h.query(api.meals.forDate, { userId: args.userId, date: args.date }),
  ).toHaveLength(0);
});
test("retention deletes operation records and refuses expired keyed submissions", async () => {
  const { t, h, args } = await setup();
  const mealId = await h.mutation(api.meals.add, args);
  const date = offsetDate(todayDate(), -14);
  await t.run((ctx) =>
    ctx.db.insert("mealOperations", {
      operationId: crypto.randomUUID(),
      fingerprint: "test",
      date,
      mealId,
      userId: args.userId,
    }),
  );
  await t.mutation(internal.crons.purgeOldMeals, {});
  expect(
    await t.run((ctx) => ctx.db.query("mealOperations").collect()),
  ).toHaveLength(1);
  await expect(h.mutation(api.meals.add, { ...args, date })).rejects.toThrow(
    "retention",
  );
});
