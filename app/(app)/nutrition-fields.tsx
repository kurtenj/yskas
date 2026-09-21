"use client";
import { useState } from "react";
import { Barbell, Plant } from "@phosphor-icons/react";
import { energyMismatch, Nutrition, parseNutrition } from "@/lib/nutrition";

/** Used in both the estimate preview and saved-meal corrections. */
export function NutritionFields({
  value,
  onChange,
  onValidChange,
}: {
  value: Nutrition;
  onChange: (value: Nutrition) => void;
  onValidChange: (valid: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    calories: String(value.calories),
    protein: value.protein === undefined ? "" : String(value.protein),
    fiber: value.fiber === undefined ? "" : String(value.fiber),
  }));
  const [error, setError] = useState("");
  function change(key: keyof typeof draft, text: string) {
    const next = { ...draft, [key]: text };
    setDraft(next);
    try {
      const parsed = parseNutrition({
        ...value,
        calories: next.calories.trim() ? Number(next.calories) : NaN,
        protein: next.protein.trim() ? Number(next.protein) : undefined,
        fiber: next.fiber.trim() ? Number(next.fiber) : undefined,
      });
      setError("");
      onValidChange(true);
      onChange(parsed);
    } catch {
      setError("Enter nonnegative numbers. Calories are required.");
      onValidChange(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["calories", "Calories (kcal)", null],
            ["protein", "Protein (g)", Barbell],
            ["fiber", "Fiber (g)", Plant],
          ] as const
        ).map(([key, label, Icon]) => (
          <label
            key={key}
            className="flex min-w-0 flex-col gap-1 text-xs text-mist-400"
          >
            <span className="flex items-center gap-1">
              {Icon && <Icon size={16} weight="fill" aria-hidden="true" />}
              {label}
            </span>
            <input
              type="number"
              min="0"
              step="any"
              required={key === "calories"}
              value={draft[key]}
              onChange={(e) => change(key, e.target.value)}
              placeholder="Unknown"
              aria-invalid={!!error}
              className="min-w-0 w-full rounded-lg border border-mist-800 bg-mist-950 px-2 py-2 text-base text-mist-100"
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-mist-500">
        Correct individual values. Changing calories keeps protein and fiber
        unchanged. Blank grams mean unknown.
      </p>
      {error && (
        <p role="alert" className="text-xs text-mist-200">
          {error}
        </p>
      )}
      {!error && energyMismatch(value) && (
        <p role="status" className="text-xs text-mist-400">
          Calories and macros differ substantially. Check the portion or label.
        </p>
      )}
    </div>
  );
}
