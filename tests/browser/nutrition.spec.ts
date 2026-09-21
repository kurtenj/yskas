import { expect, test } from "@playwright/test";
test("failed automatic save retries the existing estimate without another provider call", async ({
  page,
}) => {
  let estimates = 0;
  await page.route("**/api/estimate", (route) => {
    estimates++;
    return route.fulfill({ json: { name: "Beans", calories: 200, fiber: 8 } });
  });
  await page.goto("/");
  await page.evaluate(() => {
    (window as unknown as { failNextSave: boolean }).failNextSave = true;
  });
  await page.getByRole("textbox", { name: "What did you eat?" }).fill("beans");
  await page.getByRole("button", { name: "Log meal", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Tap Retry");
  await page.getByRole("button", { name: "Retry saving meal" }).click();
  await expect(page.getByRole("status")).toHaveText("Logged Beans");
  expect(estimates).toBe(1);
});
test("simple summary has no rings, duplicate calorie total, or meal editing", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("cal remaining", { exact: true })).toBeVisible();
  await expect(page.getByText(/of 1,800 kcal/)).toHaveCount(0);
  await expect(page.locator("circle")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit Eggs" })).toHaveCount(0);
  await expect(page.getByText(/of consumed calories/)).toHaveCount(0);
  await page.getByRole("link", { name: "Test profile" }).click();
  await page.getByLabel("Protein (g)").fill("120");
  await page.getByLabel("Fiber (g)").fill("25");
  await page.getByRole("button", { name: "Save goals" }).click();
  await page.getByRole("link", { name: "Back to home" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("returning from an idle background refreshes the date without polling", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-09-22T04:00:00Z") });
  await page.goto("/");
  await expect(page.getByText("Monday, September 21")).toBeVisible();
  await page.clock.setSystemTime(new Date("2026-09-23T16:00:00Z"));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.getByText("Wednesday, September 23")).toBeVisible();
});
test("text calculates and saves immediately, with fiber in the main dots", async ({
  page,
}) => {
  await page.route("**/api/estimate", (route) =>
    route.fulfill({
      json: { name: "Beans", calories: 200.5, protein: 12, fiber: 8.7 },
    }),
  );
  await page.goto("/#/settings");
  await page.getByLabel("Fiber (g)").fill("25");
  await page.getByRole("button", { name: "Save goals" }).click();
  await page.getByRole("link", { name: "Back to home" }).click();
  await page
    .getByRole("textbox", { name: "What did you eat?" })
    .fill("one cup beans");
  await page.getByRole("button", { name: "Log meal", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Logged Beans");
  await expect(
    page.getByRole("button", { name: "Save meal", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".grid-cols-10 .bg-emerald-500").first(),
  ).toBeVisible();
  const calls = await page.evaluate(
    () =>
      (
        window as unknown as {
          testCalls: { name: string; args: Record<string, unknown> }[];
        }
      ).testCalls,
  );
  expect(calls.filter((call) => call.name === "meals:add")).toHaveLength(1);
  expect(calls.find((call) => call.name === "meals:add")?.args).toMatchObject({
    description: "one cup beans",
    calories: 200.5,
    protein: 12,
    fiber: 8.7,
  });
});
test("reusing a suggestion replaces conflicting typed quantity with the source description", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "What did you eat?" })
    .fill("two boiled eggs");
  await page.getByRole("button", { name: /Eggs.*one boiled egg/ }).click();
  await expect(page.getByRole("status")).toHaveText("Logged Eggs");
  const calls = await page.evaluate(
    () =>
      (
        window as unknown as {
          testCalls: { name: string; args: Record<string, unknown> }[];
        }
      ).testCalls,
  );
  expect(calls.find((call) => call.name === "meals:reuse")?.args).toMatchObject(
    {
      sourceId: "legacy",
      correction: { calories: 70, protein: 6, fiber: null },
    },
  );
});
test("midnight refreshes the visible day but preserves an in-flight meal's logging date", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-09-22T04:59:59Z") });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/estimate", async (route) => {
    await held;
    await route.fulfill({
      json: { name: "Beans", calories: 200, protein: 12, fiber: 8 },
    });
  });
  await page.goto("/");
  await expect(page.getByText("Monday, September 21")).toBeVisible();
  await page.getByRole("textbox", { name: "What did you eat?" }).fill("beans");
  await page.getByRole("button", { name: "Log meal", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Estimating meal...");
  await page.clock.fastForward(120_000);
  await expect(page.getByText("Tuesday, September 22")).toBeVisible();
  release();
  await expect(page.getByRole("status")).toHaveText("Logged Beans");
  const calls = await page.evaluate(
    () =>
      (
        window as unknown as {
          testCalls: { name: string; args: Record<string, unknown> }[];
        }
      ).testCalls,
  );
  expect(calls.find((call) => call.name === "meals:add")?.args.date).toBe(
    "2026-09-21",
  );
});
