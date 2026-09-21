"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@base-ui/react/button";
import { Barbell, Bread, Plant, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { m } from "motion/react";
import { LOGGING_TIMEZONE } from "@/lib/dates";
import { useLoggingDay } from "@/lib/use-logging-day";
import { formatQuantity, goalProgress, nutritionTotals } from "@/lib/nutrition";

const TOTAL = 50;

const DOT_DELAYS = Array.from({ length: TOTAL }, (_, i) => i * 0.01).sort(
  () => Math.random() - 0.5,
);

function CalorieDotGrid({
  consumed,
  goal,
  proteinG,
  proteinGoal,
  fiberGoal,
  totals,
}: {
  consumed: number;
  goal: number;
  proteinG: number;
  proteinGoal?: number;
  fiberGoal?: number;
  totals: ReturnType<typeof nutritionTotals>;
}) {
  const consumedDots = Math.round(
    Math.min(Math.max(goalProgress(consumed, goal) ?? 0, 0), 1) * TOTAL,
  );
  const proteinDots = Math.min(
    Math.round((goalProgress(proteinG * 4, goal) ?? 0) * TOTAL),
    consumedDots,
  );
  // Fiber is a goal-progress overlay, not a claimed calorie conversion.
  const fiberDots = Math.min(
    consumedDots - proteinDots,
    totals.fiber.grams && fiberGoal
      ? Math.max(
          1,
          Math.round(
            consumedDots *
              Math.min(goalProgress(totals.fiber.grams, fiberGoal) ?? 0, 1),
          ),
        )
      : 0,
  );
  const otherDots = consumedDots - proteinDots - fiberDots;

  const dots = [
    ...Array(otherDots).fill("other"),
    ...Array(proteinDots).fill("protein"),
    ...Array(fiberDots).fill("fiber"),
    ...Array(TOTAL - consumedDots).fill("empty"),
  ];

  return (
    <div className="flex flex-col gap-6 py-4">
      <div
        className="grid grid-cols-10 gap-2"
        role="img"
        aria-label="Daily calorie guide with protein and fiber highlights"
      >
        {dots.map((type, i) => (
          <m.div
            key={i}
            className={`rounded-full aspect-square ${type === "other" ? "bg-mist-200" : type === "empty" ? "bg-mist-800" : type === "fiber" ? "bg-emerald-500" : ""}`}
            style={
              type === "protein"
                ? { backgroundColor: "oklch(71.5% 0.143 215.221)" }
                : undefined
            }
            initial={{ y: -320, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              type: "spring",
              damping: 24,
              stiffness: 320,
              delay: DOT_DELAYS[i],
            }}
          />
        ))}
      </div>
      <div className="flex justify-end text-mist-200">
        <div className="text-right">
          <span className="text-5xl font-bold font-agdasima">
            {formatQuantity(Math.max(goal - consumed, 0))}
          </span>
          <p className="text-sm">
            cal remaining
            {consumed > goal
              ? ` / ${formatQuantity(consumed - goal)} over`
              : ""}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <NutrientProgress
          label="Protein"
          nutrient={totals.protein}
          goal={proteinGoal}
        />
        <NutrientProgress
          label="Fiber"
          nutrient={totals.fiber}
          goal={fiberGoal}
        />
      </div>
    </div>
  );
}

function NutrientProgress({
  label,
  nutrient,
  goal,
}: {
  label: "Protein" | "Fiber";
  nutrient: { grams: number | null; missing: number };
  goal?: number;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="min-w-0 text-sm">
        <p className="text-mist-200">{label}</p>
        <p>
          {nutrient.grams === null
            ? "Unknown"
            : `${formatQuantity(nutrient.grams)}g${nutrient.missing ? " known" : ""}`}
          {goal ? ` / ${formatQuantity(goal)}g` : ""}
        </p>
        {!goal && (
          <Link href="/settings" className="text-xs underline text-mist-400">
            Set daily goal
          </Link>
        )}
        {!!nutrient.missing && (
          <p className="text-xs text-mist-500">
            {nutrient.missing} meal{nutrient.missing === 1 ? "" : "s"} unknown
          </p>
        )}
      </div>
    </div>
  );
}

function MealItem({
  meal,
  onDelete,
}: {
  meal: Doc<"meals">;
  onDelete: (id: Id<"meals">) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-mist-100 truncate">{meal.name}</p>
          {meal.provenance && meal.provenance.servingMultiplier !== 1 && (
            <p className="text-xs text-mist-500">
              {formatQuantity(meal.provenance.servingMultiplier)}× original
              portion
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-1">
            {(
              [
                { type: "protein", Icon: Barbell, value: meal.protein },
                { type: "fiber", Icon: Plant, value: meal.fiber },
                { type: "carbs", Icon: Bread, value: meal.carbs },
              ] as const
            )
              .filter(
                ({ type, value }) => type !== "carbs" || value !== undefined,
              )
              .map(({ type, Icon, value }) => (
                <span
                  key={type}
                  title={type}
                  aria-label={`${type}: ${value === undefined ? "unknown" : `${value} grams`}`}
                  className="flex items-center gap-1 text-mist-500 text-sm"
                >
                  <Icon size={20} weight="fill" aria-hidden="true" />
                  {value === undefined
                    ? "Unknown"
                    : `${formatQuantity(value)}g`}
                </span>
              ))}
          </div>
        </div>
        <span className="text-mist-300 text-2xl shrink-0 font-agdasima">
          {formatQuantity(meal.calories)}
        </span>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onDelete(meal._id);
            } catch {
              setError("Could not delete meal.");
              setBusy(false);
            }
          }}
          className="p-1 text-mist-500 hover:text-mist-300"
          aria-label={`Delete ${meal.name}`}
        >
          <Trash size={16} weight="fill" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-mist-200">
          {error}
        </p>
      )}
    </div>
  );
}

export default function TodayPage() {
  const { userId } = useUser();
  const day = useLoggingDay();
  const user = useQuery(api.users.get, userId ? { id: userId } : "skip");
  const meals = useQuery(
    api.meals.forDate,
    userId ? { userId, date: day } : "skip",
  );
  const removeMeal = useMutation(api.meals.remove);
  const [scrolled, setScrolled] = useState(false);

  if (!userId || user === undefined || user === null || meals === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" />
      </div>
    );
  }

  const totals = nutritionTotals(meals);
  const consumed = totals.calories;
  const proteinG = totals.protein.grams ?? 0;
  const goal = user.dailyCalorieGoal;
  const dateLabel = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: LOGGING_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="h-dvh flex flex-col max-w-lg mx-auto">
      <div className="px-6 pt-6 shrink-0">
        <div className="flex items-center justify-between mb-4 text-mist-200">
          <p>{dateLabel}</p>
          <Link
            href="/settings"
            className="hover:text-mist-50 transition-colors"
          >
            {user.name}
          </Link>
        </div>
        <CalorieDotGrid
          consumed={consumed}
          goal={goal}
          proteinG={proteinG}
          proteinGoal={user.dailyProteinGoal}
          fiberGoal={user.dailyFiberGoal}
          totals={totals}
        />
      </div>

      {meals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-mist-400 text-sm">No meals logged yet today.</p>
        </div>
      ) : (
        <div
          className="px-6 overflow-y-auto flex-1 pb-28"
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
          style={
            scrolled
              ? {
                  maskImage:
                    "linear-gradient(to bottom, transparent, black 2rem)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent, black 2rem)",
                }
              : undefined
          }
        >
          <div className="bg-mist-900 rounded-lg px-4 flex flex-col divide-y divide-mist-950">
            {meals.map((meal) => (
              <MealItem
                key={meal._id}
                meal={meal}
                onDelete={(id) => removeMeal({ id })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
