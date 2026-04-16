"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function CalorieRing({
  consumed,
  goal,
}: {
  consumed: number;
  goal: number;
}) {
  const pct = Math.min(consumed / goal, 1);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const over = consumed > goal;

  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke="#1e293b"
            strokeWidth="10"
          />
          <circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke={over ? "#ef4444" : "#10b981"}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${over ? "text-red-400" : "text-white"}`}>
            {consumed.toLocaleString()}
          </span>
          <span className="text-slate-400 text-xs mt-0.5">of {goal.toLocaleString()} cal</span>
        </div>
      </div>
      <div className="flex gap-6 mt-4 text-sm">
        <div className="text-center">
          <p className={`font-semibold ${over ? "text-red-400" : "text-emerald-400"}`}>
            {over ? `+${(consumed - goal).toLocaleString()}` : (goal - consumed).toLocaleString()}
          </p>
          <p className="text-slate-500 text-xs">{over ? "over" : "remaining"}</p>
        </div>
      </div>
    </div>
  );
}

function MealItem({
  meal,
  onDelete,
}: {
  meal: { _id: Id<"meals">; name: string; calories: number; description: string; protein?: number; carbs?: number; fat?: number };
  onDelete: (id: Id<"meals">) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{meal.name}</p>
        <p className="text-slate-500 text-xs truncate mt-0.5">{meal.description}</p>
        {(meal.protein !== undefined || meal.carbs !== undefined || meal.fat !== undefined) && (
          <p className="text-slate-600 text-xs mt-0.5">
            {meal.protein !== undefined && `P ${meal.protein}g`}
            {meal.carbs !== undefined && ` · C ${meal.carbs}g`}
            {meal.fat !== undefined && ` · F ${meal.fat}g`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-emerald-400 font-semibold text-sm whitespace-nowrap">
          {meal.calories} cal
        </span>
        <button
          onClick={() => onDelete(meal._id)}
          className="text-slate-600 hover:text-red-400 transition-colors p-1"
          aria-label="Delete meal"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function TodayPage() {
  const { userId } = useUser();
  const today = todayDate();

  const user = useQuery(api.users.get, userId ? { id: userId } : "skip");
  const meals = useQuery(
    api.meals.forDate,
    userId ? { userId, date: today } : "skip"
  );
  const removeMeal = useMutation(api.meals.remove);

  if (!userId || user === undefined || meals === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const consumed = meals.reduce((sum, m) => sum + m.calories, 0);
  const goal = user?.dailyCalorieGoal ?? 1800;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-white">Today</h1>
          <p className="text-slate-500 text-sm">{dateLabel}</p>
        </div>
        <div className="text-sm text-slate-400">
          Hi, <span className="text-white font-medium">{user?.name}</span>
        </div>
      </div>

      <CalorieRing consumed={consumed} goal={goal} />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wide">
          Meals · {meals.length}
        </h2>
        <Link
          href="/add"
          className="text-emerald-400 text-sm font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add meal
        </Link>
      </div>

      {meals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-600 text-sm">No meals logged yet today.</p>
          <Link
            href="/add"
            className="inline-block mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Log your first meal
          </Link>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl px-4">
          {meals.map((meal) => (
            <MealItem
              key={meal._id}
              meal={meal}
              onDelete={(id) => removeMeal({ id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
