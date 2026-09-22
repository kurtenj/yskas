import { expect, test } from "@playwright/test";

test("daily goals save independently and optional fiber can be cleared", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByLabel("Calories (kcal)").fill("2000");
  await page.getByLabel("Protein (g)").fill("100");
  await page.getByLabel("Fiber (g)").fill("40");
  await page.getByRole("button", { name: "Save goals" }).click();
  await expect(page.getByRole("button", { name: "Saved!", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page.getByText("1,930", { exact: true })).toBeVisible();
  await page.evaluate(() => { window.location.hash = "/settings"; });
  await expect(page.getByLabel("Protein (g)")).toHaveValue("100");
  await expect(page.getByLabel("Fiber (g)")).toHaveValue("40");
  await page.getByLabel("Fiber (g)").fill("");
  await page.getByRole("button", { name: "Save goals" }).click();
  await expect(page.getByRole("button", { name: "Saved!", exact: true })).toBeVisible();
  await expect(page.getByLabel("Protein (g)")).toHaveValue("100");
  await expect(page.getByLabel("Fiber (g)")).toHaveValue("");
});

test("switching profiles reaches selection and selecting a profile returns home", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Switch profile" }).click();
  await expect(page.getByText("Select your profile to continue")).toBeVisible();
  await page.getByRole("button", { name: /Test profile/ }).click();
  await expect(page.getByRole("img", { name: "Daily calorie guide with protein and fiber highlights" })).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
  expect(await page.evaluate(() => (window as unknown as { testCalls: { name: string }[] }).testCalls.map((call) => call.name))).toEqual(["profile:clear", "profile:select"]);
});
