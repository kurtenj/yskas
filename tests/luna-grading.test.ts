// @vitest-environment node
import { expect, test } from "vitest";
import { fixtures, grade } from "../evals/luna-fixtures";
test("missing is not zero and absent known nutrients fail", () => {
  const missing = fixtures.find((f) => f.id === "missing-fiber")!;
  expect(grade(missing, { calories: 300, protein: 25, fiber: 0 })!.fiber.pass).toBe(false);
  expect(grade(missing, { calories: 300, protein: 25 })!.fiber.pass).toBe(true);
  expect(grade(fixtures.find((f) => f.id === "zero")!, {})!.fiber.pass).toBe(false);
});
test("reference tolerances and signed errors preserve outliers", () => {
  const apple = fixtures.find((f) => f.id === "apple")!;
  expect(grade(apple, { calories: 150, protein: 1, fiber: 5 })!.calories).toMatchObject({ error: 20, pass: false });
  expect(grade(apple, { calories: 120, protein: 1, fiber: 5 })!.calories).toMatchObject({ error: -10, pass: true });
});
test("ambiguous descriptions have no invented accuracy score", () => {
  expect(grade(fixtures.find((f) => f.id === "vague-shake")!, {})).toBeNull();
});
