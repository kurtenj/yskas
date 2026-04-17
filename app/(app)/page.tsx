"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@base-ui/react/button";
import { Armchair, Barbell, Bread, Trash } from "@phosphor-icons/react";

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TOTAL = 50;

function CalorieDotGrid({
  consumed,
  goal,
  proteinG,
}: {
  consumed: number;
  goal: number;
  proteinG: number;
}) {
  const consumedDots = Math.round((Math.min(consumed, goal) / goal) * TOTAL);
  const proteinDots = Math.min(
    Math.round(((proteinG * 4) / goal) * TOTAL),
    consumedDots,
  );
  const otherDots = consumedDots - proteinDots;

  const dots = [
    ...Array(otherDots).fill("other"),
    ...Array(proteinDots).fill("protein"),
    ...Array(TOTAL - consumedDots).fill("empty"),
  ];

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="grid grid-cols-10 gap-2">
        {dots.map((type, i) => (
          <div
            key={i}
            className={`rounded-full aspect-square ${type === "other" ? "bg-mist-200" : type === "empty" ? "bg-mist-900" : ""}`}
            style={
              type === "protein"
                ? { backgroundColor: "oklch(63.7% 0.237 25.3)" }
                : undefined
            }
          />
        ))}
      </div>
      <div className="flex items-end justify-between text-mist-200">
        <div className="flex flex-col">
          <span className="text-7xl font-bold font-agdasima">
            {proteinG.toLocaleString()}
          </span>
          <span className="text-lg">protein</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-7xl font-bold font-agdasima">
            {Math.max(goal - consumed, 0).toLocaleString()}
          </span>
          <span className="text-lg">remaining</span>
        </div>
      </div>
    </div>
  );
}

function MealItem({
  meal,
  onDelete,
}: {
  meal: {
    _id: Id<"meals">;
    name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  onDelete: (id: Id<"meals">) => void;
}) {
  const macros = [
    meal.protein !== undefined && {
      icon: Barbell,
      value: meal.protein,
      key: "p",
    },
    meal.carbs !== undefined && { icon: Bread, value: meal.carbs, key: "c" },
    meal.fat !== undefined && { icon: Armchair, value: meal.fat, key: "f" },
  ].filter(Boolean) as {
    icon: React.ElementType;
    value: number;
    key: string;
  }[];

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-mist-100 truncate">{meal.name}</p>
        {macros.length > 0 && (
          <div className="flex items-center gap-2 mt-1">
            {macros.map(({ icon: Icon, value, key }) => (
              <span
                key={key}
                className="flex items-center gap-1 text-mist-500 text-sm"
              >
                <Icon size={16} weight="fill" />
                {value}g
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="text-mist-300 text-sm shrink-0">
        {meal.calories} cal
      </span>
      <Button
        onClick={() => onDelete(meal._id)}
        className="text-mist-500 hover:text-mist-300 transition-colors p-1 shrink-0"
        aria-label="Delete meal"
      >
        <Trash size={16} weight="fill" />
      </Button>
    </div>
  );
}

export default function TodayPage() {
  const { userId } = useUser();
  const user = useQuery(api.users.get, userId ? { id: userId } : "skip");
  const meals = useQuery(
    api.meals.forDate,
    userId ? { userId, date: todayDate() } : "skip",
  );
  const removeMeal = useMutation(api.meals.remove);

  if (!userId || user === undefined || user === null || meals === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" />
      </div>
    );
  }

  const consumed = meals.reduce((sum, m) => sum + m.calories, 0);
  const proteinG = meals.reduce((sum, m) => sum + (m.protein ?? 0), 0);
  const goal = user.dailyCalorieGoal ?? 1800;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="px-6 pt-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 text-mist-200">
        <p>{dateLabel}</p>
        <p>{user.name}</p>
      </div>

      <CalorieDotGrid consumed={consumed} goal={goal} proteinG={proteinG} />

      {meals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-mist-400 text-sm">No meals logged yet today.</p>
          <Link
            href="/add"
            className="inline-block mt-4 bg-mist-900 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Log your first meal
          </Link>
        </div>
      ) : (
        <div className="bg-mist-900 rounded-lg px-4 flex flex-col divide-y divide-mist-950">
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
