"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { Progress } from "@base-ui/react/progress";

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getLast7Days(): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(localDateString(d));
  }
  return dates;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = localDateString(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateString(yesterdayDate);

  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";

  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const over = value > max;
  return (
    <Progress.Root value={value} max={max} className="mt-2">
      <Progress.Track className="h-1.5 bg-mist-800 rounded-full overflow-hidden">
        <Progress.Indicator
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-mist-100"}`}
          style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        />
      </Progress.Track>
    </Progress.Root>
  );
}

export default function HistoryPage() {
  const { userId } = useUser();
  const dates = getLast7Days();

  const user = useQuery(api.users.get, userId ? { id: userId } : "skip");
  const meals = useQuery(
    api.meals.forDateRange,
    userId ? { userId, dates } : "skip"
  );

  if (!userId || meals === undefined || user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-mist-800 border-t-mist-100 rounded-full animate-spin" />
      </div>
    );
  }

  const goal = user?.dailyCalorieGoal ?? 1800;

  // Group meals by date
  const byDate: Record<string, typeof meals> = {};
  for (const meal of meals) {
    if (!byDate[meal.date]) byDate[meal.date] = [];
    byDate[meal.date].push(meal);
  }

  // Weekly total
  const weekTotal = meals.reduce((sum, m) => sum + m.calories, 0);
  const weekGoal = goal * 7;

  return (
    <div className="h-dvh flex flex-col pb-20 max-w-lg mx-auto px-4 pt-6">
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-mist-50 mb-1">History</h1>
        <p className="text-mist-400 text-sm mb-5">Last 7 days</p>

        {/* Weekly summary card */}
        <div className="bg-mist-900 border border-mist-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-mist-500 text-xs uppercase tracking-wide">This week</p>
              <p className="text-2xl font-bold text-mist-50 mt-0.5">
                {weekTotal.toLocaleString()} <span className="text-mist-400 text-sm font-normal">cal</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-mist-500 text-xs">Goal</p>
              <p className="text-mist-50 text-sm font-medium">{weekGoal.toLocaleString()}</p>
            </div>
          </div>
          <ProgressBar value={weekTotal} max={weekGoal} />
        </div>
      </div>

      {/* Day-by-day */}
      <div className="overflow-y-auto flex-1 pb-4 space-y-3">
        {dates.map((date) => {
          const dayMeals = byDate[date] ?? [];
          const dayTotal = dayMeals.reduce((sum, m) => sum + m.calories, 0);
          const over = dayTotal > goal;
          const hasData = dayMeals.length > 0;

          return (
            <div key={date} className="bg-mist-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-mist-50 font-medium text-sm">{formatDate(date)}</p>
                <p className={`font-semibold text-sm ${!hasData ? "text-mist-600" : over ? "text-red-400" : "text-mist-50"}`}>
                  {hasData ? `${dayTotal.toLocaleString()} cal` : "—"}
                </p>
              </div>
              {hasData && <ProgressBar value={dayTotal} max={goal} />}
              {hasData && (
                <div className="mt-2 space-y-1">
                  {dayMeals.map((m) => (
                    <div key={m._id} className="flex justify-between text-xs">
                      <span className="text-mist-400 truncate">{m.name}</span>
                      <span className="text-mist-600 ml-2 shrink-0">{m.calories} cal</span>
                    </div>
                  ))}
                </div>
              )}
              {!hasData && (
                <p className="text-mist-600 text-xs mt-1">No meals logged</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

}
