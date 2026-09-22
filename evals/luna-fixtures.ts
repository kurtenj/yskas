// Small selection pilot, not a representative nutrition accuracy corpus.
export const fields = ["calories", "protein", "fiber"] as const;
type Values = Record<(typeof fields)[number], number | null>;
export type Fixture = { id: string; category: string; input: string; expected?: Values; tolerance?: Values; source: string };
const labelSource = "https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label";
const fruitSource = "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/raw-fruits-poster-text-version-accessible-version";
const label = "Lasagna label per cup: 280 calories, 15g protein, 4g fiber, 34g carbs, 9g fat.";
export const fixtures: Fixture[] = [
  ...[0.5, 1, 2, 4].map((portion) => ({ id: `label-${portion}`, category: "label", input: `${label} I ate ${portion} cups.`, expected: { calories: 280 * portion, protein: 15 * portion, fiber: 4 * portion }, tolerance: { calories: 0.01, protein: 0.01, fiber: 0.01 }, source: labelSource })),
  ...([
    ["apple", 242, 130, 1, 5], ["banana", 126, 110, 1, 3],
    ["orange", 154, 80, 1, 3], ["pear", 166, 100, 1, 6],
    ["strawberries", 147, 50, 1, 2], ["kiwifruit", 148, 90, 1, 4],
  ] as const).map(([food, grams, calories, protein, fiber]) => ({ id: food, category: "food-reference", input: `${grams} grams edible portion of raw ${food}, nothing added.`, expected: { calories, protein, fiber }, tolerance: { calories: Math.max(10, calories * 0.15), protein: 1, fiber: 1.5 }, source: fruitSource })),
  { id: "half-bar", category: "synthetic-contract", input: "Half a bar. The whole bar label says 210 calories, 20g protein, 7g fiber, 23g carbs, 8g fat.", expected: { calories: 105, protein: 10, fiber: 3.5 }, source: "Synthetic explicit label; arithmetic truth only" },
  { id: "shake", category: "synthetic-contract", input: "250ml milk (per 100ml: 60 calories, 3g protein, 0g fiber, 5g carbs, 3g fat) plus 30g powder (per 30g: 120 calories, 24g protein, 2g fiber, 3g carbs, 1g fat).", expected: { calories: 270, protein: 31.5, fiber: 2 }, source: "Synthetic explicit labels; arithmetic truth only" },
  { id: "missing-fiber", category: "synthetic-contract", input: "One experimental meal pack: 300 calories and 25g protein. Fiber, carbs and fat are unknown; ingredients are unavailable. Do not infer the unknown nutrients.", expected: { calories: 300, protein: 25, fiber: null }, source: "Synthetic missing-data contract" },
  { id: "zero", category: "synthetic-contract", input: "One bottle labeled 0 calories, 0g protein, 0g fiber, 0g carbs and 0g fat.", expected: { calories: 0, protein: 0, fiber: 0 }, source: "Synthetic known-zero contract" },
  { id: "vague-shake", category: "indeterminate", input: "Milk with protein powder", source: "No determinate reference; inspect outputs without accuracy scoring" },
  { id: "vague-dinner", category: "indeterminate", input: "A bowl of chicken rice and beans", source: "No determinate reference; inspect outputs without accuracy scoring" },
];

export function grade(fixture: Fixture, meal: Record<string, unknown>) {
  if (!fixture.expected) return null;
  return Object.fromEntries(fields.map((field) => {
    const expected = fixture.expected![field];
    const actual = meal[field];
    const numeric = typeof actual === "number" && Number.isFinite(actual);
    const error = expected !== null && numeric ? actual - expected : null;
    return [field, { expected, actual: actual ?? null, error, pass: expected === null ? actual == null : error !== null && Math.abs(error) <= (fixture.tolerance?.[field] ?? 0.01) }];
  }));
}
