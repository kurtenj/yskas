import { expect, test } from "@playwright/test";
test("mobile summary, unknown fiber, saved correction, goals, and emerald graph", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "Fiber: unknown, goal not set" }),
  ).toBeVisible();
  await expect(page.locator("circle.text-emerald-500")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit Eggs" }).click();
  await page.getByLabel("Fiber (g)").fill("2.5");
  await page.getByLabel("Calories (kcal)").fill("75.5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByLabel("fiber: 2.5 grams", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("protein: 6 grams", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Test profile" }).click();
  await page.getByLabel("Protein (g)").fill("120");
  await page.getByLabel("Fiber (g)").fill("25");
  await page.getByRole("button", { name: "Save goals" }).click();
  await expect(page.getByRole("button", { name: "Saved!" })).toBeVisible();
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(
    page.getByRole("img", { name: "Fiber: 2.5 grams of 25 grams" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".grid-cols-10 > div").last()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({
    path: "test-results/nutrition-mobile.png",
    fullPage: true,
  });
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
test("estimate correction preserves original values and cannot save empty calories", async ({
  page,
}) => {
  await page.route("**/api/estimate", (route) =>
    route.fulfill({
      json: {
        name: "Beans",
        calories: 200.5,
        protein: 12,
        fiber: 8.7,
        estimate: {
          model: "gpt-4o-mini",
          promptVersion: "nutrition-2",
          schemaVersion: 2,
        },
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "What did you eat?" })
    .fill("one cup beans");
  await page.getByRole("button", { name: "Estimate calories" }).click();
  await expect(page.getByLabel("Fiber (g)")).toHaveValue("8.7");
  await page.getByLabel("Calories (kcal)").fill("");
  await expect(page.getByRole("button", { name: "Save meal" })).toBeDisabled();
  await page.getByLabel("Calories (kcal)").fill("210.5");
  await page.getByRole("button", { name: "Save meal" }).click();
  await expect(page.getByRole("status")).toHaveText("Logged Beans");
  const calls = await page.evaluate(
    () =>
      (
        window as unknown as {
          testCalls: { name: string; args: Record<string, unknown> }[];
        }
      ).testCalls,
  );
  expect(calls.find((call) => call.name === "meals:add")?.args).toMatchObject({
    description: "one cup beans",
    calories: 210.5,
    protein: 12,
    fiber: 8.7,
    originalNutrition: { calories: 200.5, protein: 12, fiber: 8.7 },
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
  await expect(
    page.getByRole("textbox", { name: "What did you eat?" }),
  ).toHaveValue("one boiled egg");
  await expect(page.getByLabel("Fiber (g)")).toHaveValue("");
  await page.getByRole("button", { name: "Save meal" }).click();
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
  await page.getByRole("button", { name: "Estimate calories" }).click();
  await expect(page.getByRole("status")).toHaveText("Estimating meal...");
  await page.clock.fastForward(120_000);
  await expect(page.getByText("Tuesday, September 22")).toBeVisible();
  release();
  await page.getByRole("button", { name: "Save meal" }).click();
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
