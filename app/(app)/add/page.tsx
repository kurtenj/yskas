"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";

interface Estimate {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
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
      <h1 className="text-xl font-bold text-white mb-1">Log a Meal</h1>
      <p className="text-slate-400 text-sm mb-6">Describe what you ate in plain language</p>

      {!estimate ? (
        <form onSubmit={handleEstimate} className="space-y-4">
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. two slices of whole wheat toast with peanut butter and a banana"
              rows={4}
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-emerald-500 resize-none placeholder:text-slate-600 text-sm leading-relaxed"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!description.trim() || loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Estimating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Estimate calories
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Meal description recap */}
          <div className="bg-slate-800/50 rounded-xl px-4 py-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">You described</p>
            <p className="text-white text-sm">{description}</p>
          </div>

          {/* Estimate card */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Estimated meal</p>
                <h2 className="text-white text-lg font-semibold">{estimate.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-400">{estimate.calories}</p>
                <p className="text-slate-400 text-xs">calories</p>
              </div>
            </div>

            {(estimate.protein !== undefined || estimate.carbs !== undefined || estimate.fat !== undefined) && (
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700">
                {estimate.protein !== undefined && (
                  <div className="text-center">
                    <p className="text-white font-semibold">{estimate.protein}g</p>
                    <p className="text-slate-500 text-xs">Protein</p>
                  </div>
                )}
                {estimate.carbs !== undefined && (
                  <div className="text-center">
                    <p className="text-white font-semibold">{estimate.carbs}g</p>
                    <p className="text-slate-500 text-xs">Carbs</p>
                  </div>
                )}
                {estimate.fat !== undefined && (
                  <div className="text-center">
                    <p className="text-white font-semibold">{estimate.fat}g</p>
                    <p className="text-slate-500 text-xs">Fat</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-slate-600 text-xs text-center">
            AI estimates may vary. Edit calories below if needed.
          </p>

          {/* Calorie override */}
          <div>
            <label className="block text-slate-400 text-xs uppercase tracking-wide mb-1.5">
              Adjust calories (optional)
            </label>
            <input
              type="number"
              value={estimate.calories}
              onChange={(e) =>
                setEstimate({ ...estimate, calories: parseInt(e.target.value, 10) || 0 })
              }
              className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:border-emerald-500 text-center text-xl font-bold"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 bg-slate-800 text-slate-300 rounded-xl py-4 font-medium"
            >
              Re-enter
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-xl py-4 font-semibold transition-colors"
            >
              {saving ? "Saving..." : "Save meal"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
