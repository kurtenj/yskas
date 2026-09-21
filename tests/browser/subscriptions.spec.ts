import { expect, test } from "@playwright/test";
test("suggestions subscribe only for relevant input and pause during entry and off home", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/estimate", async (route) => {
    await held;
    await route.fulfill({ json: { name: "Beans", calories: 200 } });
  });
  await page.goto("/");
  const count = () =>
    page.evaluate(
      () =>
        (window as unknown as { activeQueries: Record<string, number> })
          .activeQueries["meals:forDateRange"] ?? 0,
    );
  await expect.poll(count).toBe(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { activeQueries: Record<string, number> })
          .activeQueries["users:list"] ?? 0,
    ),
  ).toBe(0);
  const input = page.getByRole("textbox", { name: "What did you eat?" });
  await input.fill("b");
  await expect.poll(count).toBe(0);
  await input.fill("beans");
  await expect.poll(count).toBe(1);
  await page.getByRole("button", { name: "Log meal", exact: true }).click();
  await expect.poll(count).toBe(0);
  release();
  await expect(page.getByText("Logged Beans", { exact: true })).toBeVisible();
  await expect.poll(count).toBe(0);
  await input.fill("beans");
  await expect.poll(count).toBe(1);
  await page.evaluate(() => {
    window.location.hash = "/settings";
  });
  await expect(page.getByLabel("Protein (g)")).toBeVisible();
  await expect.poll(count).toBe(0);
});
