"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@base-ui/react/button";
import { Trash } from "@phosphor-icons/react";

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
            stroke="#e5e7eb"
            strokeWidth="10"
          />
          <circle
            cx="60" cy="60" r={r}
            fill="none"
            stroke={over ? "#dc2626" : "#111827"}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${over ? "text-red-600" : "text-gray-900"}`}>
            {consumed.toLocaleString()}
          </span>
          <span className="text-gray-500 text-xs mt-0.5">of {goal.toLocaleString()} cal</span>
        </div>
      </div>
      <div className="flex gap-6 mt-4 text-sm">
        <div className="text-center">
          <p className={`font-semibold ${over ? "text-red-600" : "text-gray-900"}`}>
            {over ? `+${(consumed - goal).toLocaleString()}` : (goal - consumed).toLocaleString()}
          </p>
          <p className="text-gray-500 text-xs">{over ? "over" : "remaining"}</p>
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
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 font-medium truncate">{meal.name}</p>
        <p className="text-gray-500 text-xs truncate mt-0.5">{meal.description}</p>
        {(meal.protein !== undefined || meal.carbs !== undefined || meal.fat !== undefined) && (
          <p className="text-gray-400 text-xs mt-0.5">
            {meal.protein !== undefined && `P ${meal.protein}g`}
            {meal.carbs !== undefined && ` · C ${meal.carbs}g`}
            {meal.fat !== undefined && ` · F ${meal.fat}g`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-gray-900 font-semibold text-sm whitespace-nowrap">
          {meal.calories} cal
        </span>
        <Button
          onClick={() => onDelete(meal._id)}
          className="text-gray-400 hover:text-gray-900 transition-colors p-1"
          aria-label="Delete meal"
        >
          <Trash size={16} />
        </Button>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
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
          <h1 className="text-xl font-bold text-gray-900">Today</h1>
          <p className="text-gray-500 text-sm">{dateLabel}</p>
        </div>
        <div className="text-sm text-gray-500">
          Hi, <span className="text-gray-900 font-medium">{user?.name}</span>
        </div>
      </div>

      <CalorieRing consumed={consumed} goal={goal} />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-gray-500 text-sm font-medium uppercase tracking-wide">
          Meals · {meals.length}
        </h2>
        <Link
          href="/add"
          className="text-gray-900 text-sm font-medium"
        >
          Add meal
        </Link>
      </div>

      {meals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No meals logged yet today.</p>
          <Link
            href="/add"
            className="inline-block mt-4 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Log your first meal
          </Link>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl px-4">
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
