import { expect, test } from "vitest";
import {
  changedNutrients,
  correctNutrition,
  energyMismatch,
  goalProgress,
  mealReuseKey,
  nutritionTotals,
  parseEstimate,
  positiveGoal,
  scaleNutrition,
} from "../lib/nutrition";

test("unknown, partial, zero and empty nutrition remain distinguishable", () => {
  expect(nutritionTotals([{ calories: 100 }])).toMatchObject({
    fiber: { grams: null, missing: 1 },
    proteinPercent: null,
  });
  expect(
    nutritionTotals([
      { calories: 100, protein: 10, fiber: 0 },
      { calories: 100 },
    ]),
  ).toMatchObject({
    fiber: { grams: 0, missing: 1 },
    protein: { grams: 10, missing: 1 },
    proteinPercent: null,
  });
  expect(nutritionTotals([])).toMatchObject({
    fiber: { grams: 0, missing: 0 },
    proteinPercent: null,
  });
  expect(
    nutritionTotals([{ calories: 0, protein: 0, fiber: 0 }]).proteinPercent,
  ).toBeNull();
});
test("protein percentage uses summed intake, not average percentages or the goal", () => {
  const totals = nutritionTotals([
    { calories: 100, protein: 10.5 },
    { calories: 900, protein: 20 },
  ]);
  expect(totals.proteinPercent).toBeCloseTo(12.2);
  expect(goalProgress(totals.protein.grams, 25)).toBeCloseTo(1.22);
  expect(goalProgress(null, 25)).toBeNull();
  expect(goalProgress(10, 0)).toBeNull();
  expect(goalProgress(10)).toBeNull();
});
test.each([-1, NaN, Infinity, "12", null, undefined])(
  "invalid required nutrients are rejected: %s",
  (value) => {
    expect(() => parseEstimate({ name: "Beans", calories: value })).toThrow();
  },
);
test.each([-1, NaN, Infinity, 0, "10"])(
  "invalid goals are rejected: %s",
  (value) => {
    expect(() => positiveGoal(value)).toThrow();
  },
);
test("provider decimals and explicit unknowns are preserved; bad optional fields and names rejected", () => {
  expect(
    parseEstimate({
      name: " Beans ",
      calories: 102.4,
      protein: null,
      fiber: 5.2,
    }),
  ).toEqual({ name: "Beans", calories: 102.4, fiber: 5.2 });
  for (const value of [-1, NaN, Infinity, "5"])
    expect(() =>
      parseEstimate({ name: "Beans", calories: 100, fiber: value }),
    ).toThrow();
  for (const name of ["", "   ", "a".repeat(121)])
    expect(() => parseEstimate({ name, calories: 10 })).toThrow();
});
test("correction and scaling are distinct, preserve unknowns and do not mutate the source", () => {
  const original = { calories: 100.5, protein: 10.2, carbs: 8, fat: 3 };
  const corrected = correctNutrition(original, { calories: 120, fiber: 3 });
  expect(corrected.protein).toBe(10.2);
  expect(changedNutrients(original, corrected)).toEqual(["calories", "fiber"]);
  expect(scaleNutrition(original, 2)).toEqual({
    calories: 201,
    protein: 20.4,
    carbs: 16,
    fat: 6,
  });
  expect(correctNutrition(corrected, { fiber: null }).fiber).toBeUndefined();
  expect(original.calories).toBe(100.5);
  expect(() => scaleNutrition(original, 0)).toThrow();
});
test("reuse does not deduplicate distinct portions or preparations with the same name", () => {
  const one = { name: "Eggs", description: "one boiled egg", calories: 70 };
  expect(mealReuseKey(one)).not.toBe(
    mealReuseKey({ ...one, description: "two fried eggs", calories: 180 }),
  );
  expect(mealReuseKey(one)).not.toBe(mealReuseKey({ ...one, calories: 80 }));
});
test("energy plausibility check tolerates small rounding differences without enforcing equality", () => {
  expect(
    energyMismatch({ calories: 100, protein: 10, carbs: 10, fat: 2 }),
  ).toBe(false);
  expect(
    energyMismatch({ calories: 100, protein: 100, carbs: 10, fat: 2 }),
  ).toBe(true);
  expect(energyMismatch({ calories: 100 })).toBe(false);
});
