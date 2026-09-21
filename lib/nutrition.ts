/** Shared business rules: calories are kcal; other nutrients are grams. */
export const nutrientKeys = [
  "calories",
  "protein",
  "fiber",
  "carbs",
  "fat",
] as const;
export type NutrientKey = (typeof nutrientKeys)[number];
export type Nutrition = {
  calories: number;
  protein?: number;
  fiber?: number;
  carbs?: number;
  fat?: number;
};
export type MealEstimate = Nutrition & { name: string };
export const ESTIMATE_VERSION = {
  model: "gpt-4o-mini",
  promptVersion: "nutrition-3",
  schemaVersion: 3,
} as const;
export function boundedText(
  value: unknown,
  label: string,
  max: number,
): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`${label} must contain 1–${max} characters.`);
  return value.trim();
}
export function nonnegative(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  )
    throw new Error(`${label} must be a finite, nonnegative number.`);
  return value;
}
export function positiveGoal(value: unknown): number {
  const goal = nonnegative(value, "Goal");
  if (goal === 0) throw new Error("Goal must be greater than zero.");
  return goal;
}
export function parseNutrition(value: unknown): Nutrition {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid nutrition values.");
  const record = value as Record<string, unknown>;
  const result: Nutrition = {
    calories: nonnegative(record.calories, "Calories"),
  };
  for (const key of nutrientKeys.slice(1)) {
    if (record[key] !== undefined && record[key] !== null)
      result[key] = nonnegative(record[key], key);
  }
  return result;
}
export function parseEstimate(value: unknown): MealEstimate {
  return {
    ...parseNutrition(value),
    name: boundedText(
      (value as Record<string, unknown>)?.name,
      "Meal name",
      120,
    ),
  };
}
export function scaleNutrition(value: Nutrition, factor: number): Nutrition {
  positiveGoal(factor);
  const result = parseNutrition(value);
  for (const key of nutrientKeys)
    if (result[key] !== undefined)
      result[key] = nonnegative(result[key]! * factor, key);
  return result;
}
/** null clears an optional nutrient; omitted fields stay unchanged. */
export type NutritionCorrection = Partial<Record<NutrientKey, number | null>>;
export function correctNutrition(
  value: Nutrition,
  correction: NutritionCorrection,
): Nutrition {
  return parseNutrition({ ...value, ...correction });
}
export function changedNutrients(
  original: Nutrition,
  current: Nutrition,
): NutrientKey[] {
  return nutrientKeys.filter((key) => original[key] !== current[key]);
}
export function nutritionTotals(meals: Nutrition[]) {
  const calories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  function nutrient(key: "protein" | "fiber") {
    const known = meals.filter((meal) => meal[key] !== undefined);
    return {
      grams:
        known.length || !meals.length
          ? known.reduce((sum, meal) => sum + meal[key]!, 0)
          : null,
      missing: meals.length - known.length,
    };
  }
  const protein = nutrient("protein"),
    fiber = nutrient("fiber");
  return {
    calories,
    protein,
    fiber,
    proteinPercent:
      !protein.missing && calories > 0
        ? ((protein.grams! * 4) / calories) * 100
        : null,
  };
}
export function goalProgress(
  consumed: number | null,
  goal?: number,
): number | null {
  return consumed !== null &&
    goal !== undefined &&
    Number.isFinite(goal) &&
    goal > 0
    ? consumed / goal
    : null;
}
/** Review hint, not rejection: labels, fiber and rounding differ in energy. */
export function energyMismatch(n: Nutrition): boolean {
  if (n.protein === undefined || n.carbs === undefined || n.fat === undefined)
    return false;
  return (
    Math.abs(n.protein * 4 + n.carbs * 4 + n.fat * 9 - n.calories) >
    Math.max(50, n.calories * 0.3)
  );
}
export function mealReuseKey(
  meal: MealEstimate & {
    description: string;
    provenance?: {
      servingMultiplier: number;
      estimate?: unknown;
      originalNutrition: Nutrition;
    };
  },
): string {
  return JSON.stringify([
    meal.name,
    meal.description,
    ...nutrientKeys.map((key) => meal[key] ?? null),
    meal.provenance?.servingMultiplier ?? 1,
    meal.provenance?.estimate ?? null,
    meal.provenance?.originalNutrition ?? null,
  ]);
}
export function formatQuantity(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
