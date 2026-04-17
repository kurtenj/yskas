"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";
import { Button } from "@base-ui/react/button";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";

interface Estimate {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AddMealPage() {
  const { userId } = useUser();
  const addMeal = useMutation(api.meals.add);
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleEstimate(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setError("");
    setEstimate(null);
    setLoading(true);

    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to estimate");
      setEstimate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!estimate || !userId) return;
    setSaving(true);
    try {
      await addMeal({
        userId,
        description: description.trim(),
        name: estimate.name,
        calories: estimate.calories,
        protein: estimate.protein,
        carbs: estimate.carbs,
        fat: estimate.fat,
        date: todayDate(),
      });
      router.push("/");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setEstimate(null);
    setError("");
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Log a Meal</h1>
      <p className="text-gray-500 text-sm mb-6">Describe what you ate in plain language</p>

      {!estimate ? (
        <form onSubmit={handleEstimate} className="space-y-4">
          <Field.Root>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. two slices of whole wheat toast with peanut butter and a banana"
              rows={4}
              className="w-full bg-white text-gray-900 rounded-xl px-4 py-3 border border-gray-200 focus:outline-none focus:border-gray-900 resize-none placeholder:text-gray-400 text-sm leading-relaxed"
              autoFocus
            />
          </Field.Root>

          {error && (
            <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={!description.trim() || loading}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin" />
                Estimating...
              </>
            ) : "Estimate calories"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Meal description recap */}
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">You described</p>
            <p className="text-gray-900 text-sm">{description}</p>
          </div>

          {/* Estimate card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Estimated meal</p>
                <h2 className="text-gray-900 text-lg font-semibold">{estimate.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{estimate.calories}</p>
                <p className="text-gray-500 text-xs">calories</p>
              </div>
            </div>

            {(estimate.protein !== undefined || estimate.carbs !== undefined || estimate.fat !== undefined) && (
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200">
                {estimate.protein !== undefined && (
                  <div className="text-center">
                    <p className="text-gray-900 font-semibold">{estimate.protein}g</p>
                    <p className="text-gray-500 text-xs">Protein</p>
                  </div>
                )}
                {estimate.carbs !== undefined && (
                  <div className="text-center">
                    <p className="text-gray-900 font-semibold">{estimate.carbs}g</p>
                    <p className="text-gray-500 text-xs">Carbs</p>
                  </div>
                )}
                {estimate.fat !== undefined && (
                  <div className="text-center">
                    <p className="text-gray-900 font-semibold">{estimate.fat}g</p>
                    <p className="text-gray-500 text-xs">Fat</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-gray-400 text-xs text-center">
            AI estimates may vary. Edit calories below if needed.
          </p>

          {/* Calorie override */}
          <Field.Root>
            <Field.Label className="block text-gray-500 text-xs uppercase tracking-wide mb-1.5">
              Adjust calories (optional)
            </Field.Label>
            <Input
              type="number"
              value={estimate.calories}
              onChange={(e) =>
                setEstimate({ ...estimate, calories: parseInt(e.target.value, 10) || 0 })
              }
              className="w-full bg-white text-gray-900 rounded-xl px-4 py-3 border border-gray-200 focus:outline-none focus:border-gray-900 text-center text-xl font-bold"
            />
          </Field.Root>

          <div className="flex gap-3">
            <Button
              onClick={handleReset}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-4 font-medium transition-colors"
            >
              Re-enter
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl py-4 font-semibold transition-colors"
            >
              {saving ? "Saving..." : "Save meal"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
