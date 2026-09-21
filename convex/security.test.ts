/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const issuer = "https://yskas.test";
const identity = (subject = "household", sessionVersion = "1") => ({ issuer, subject, tokenIdentifier: `${issuer}|${subject}`, sessionVersion });
beforeEach(() => {
  vi.stubEnv("AUTH_ISSUER", issuer);
  vi.stubEnv("AUTH_SESSION_VERSION", "1");
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

test("all profile/meal functions deny anonymous direct calls", async () => {
  const t = convexTest(schema, modules);
  const { userId, mealId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { name: "Private", dailyCalorieGoal: 1800 });
    const mealId = await ctx.db.insert("meals", { userId, description: "meal", name: "meal", calories: 100, date: "2026-09-21", createdAt: 1 });
    return { userId, mealId };
  });
  const calls = [
    () => t.query(api.users.list, {}), () => t.query(api.users.get, { id: userId }),
    () => t.mutation(api.users.create, { name: "x", dailyCalorieGoal: 1800 }),
    () => t.mutation(api.users.updateName, { id: userId, name: "x" }),
    () => t.mutation(api.users.updateGoal, { id: userId, dailyCalorieGoal: 1 }),
    () => t.query(api.meals.forDate, { userId, date: "2026-09-21" }),
    () => t.query(api.meals.forDateRange, { userId, dates: [] }),
    () => t.mutation(api.meals.add, { userId, description: "x", name: "x", calories: 1, date: "2026-09-21" }),
    () => t.mutation(api.meals.remove, { id: mealId }),
  ];
  for (const call of calls) await expect(call()).rejects.toThrow("Unauthorized");
});
test("household shares profiles; foreign identities and revoked sessions cannot access either", async () => {
  const t = convexTest(schema, modules);
  const household = t.withIdentity(identity());
  for (const name of ["A", "B"]) await household.mutation(api.users.create, { name, dailyCalorieGoal: 1800 });
  const profiles = await household.query(api.users.list);
  expect(profiles).toHaveLength(2);
  for (const profile of profiles) {
    await expect(t.withIdentity(identity("outsider")).query(api.users.get, { id: profile._id })).rejects.toThrow("Unauthorized");
    await household.mutation(api.users.updateName, { id: profile._id, name: "Shared" });
  }
  await expect(t.withIdentity({ ...identity(), issuer: "https://foreign.test" }).query(api.users.list)).rejects.toThrow("Unauthorized");
  vi.stubEnv("AUTH_SESSION_VERSION", "2");
  await expect(household.query(api.users.list)).rejects.toThrow("Unauthorized");
});
test("only service tokens manage quotas; PIN throttling recovers after its window", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const args = { kind: "pin" as const, leaseId: "pin" };
  await expect(t.mutation(api.limits.acquire, args)).rejects.toThrow("Unauthorized");
  await expect(t.withIdentity(identity()).mutation(api.limits.acquire, args)).rejects.toThrow("Unauthorized");
  const server = t.withIdentity(identity("service"));
  for (let i = 0; i < 10; i++) expect((await server.mutation(api.limits.acquire, args)).allowed).toBe(true);
  expect(await server.mutation(api.limits.acquire, args)).toMatchObject({ allowed: false, retryAfter: 900 });
  vi.advanceTimersByTime(900_000);
  expect((await server.mutation(api.limits.acquire, args)).allowed).toBe(true);
});
test("provider concurrency, lease expiry, minute and daily quotas recover without resetting usage on release", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
  vi.stubEnv("PROVIDER_REQUESTS_PER_MINUTE", "3");
  vi.stubEnv("PROVIDER_REQUESTS_PER_DAY", "4");
  const t = convexTest(schema, modules);
  const server = t.withIdentity(identity("service"));
  const acquire = (leaseId: string) => server.mutation(api.limits.acquire, { kind: "provider", leaseId });
  expect((await acquire("a")).allowed).toBe(true);
  expect((await acquire("b")).allowed).toBe(true);
  expect((await acquire("c")).allowed).toBe(false);
  await server.mutation(api.limits.release, { leaseId: "a" });
  expect((await acquire("c")).allowed).toBe(true);
  await server.mutation(api.limits.release, { leaseId: "c" });
  expect((await acquire("d")).allowed).toBe(false); // Minute budget remains spent.
  vi.advanceTimersByTime(120_000);
  expect((await acquire("d")).allowed).toBe(true); // Crashed lease expires.
  await server.mutation(api.limits.release, { leaseId: "d" });
  expect((await acquire("e")).allowed).toBe(false); // Daily budget.
  vi.advanceTimersByTime(86_400_000);
  expect((await acquire("e")).allowed).toBe(true);
  await t.run(async ctx => { expect(await ctx.db.query("requestLimits").collect()).toHaveLength(1); });
});
