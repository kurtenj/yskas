"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";

function getLast7Days(): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";

  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const over = value > max;
  return (
    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-2">
      <div
        className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-emerald-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-white mb-1">History</h1>
      <p className="text-slate-400 text-sm mb-5">Last 7 days</p>

      {/* Weekly summary card */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide">This week</p>
            <p className="text-2xl font-bold text-white mt-0.5">
              {weekTotal.toLocaleString()} <span className="text-slate-500 text-sm font-normal">cal</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs">Goal</p>
            <p className="text-slate-300 text-sm font-medium">{weekGoal.toLocaleString()}</p>
          </div>
        </div>
        <ProgressBar value={weekTotal} max={weekGoal} />
      </div>

      {/* Day-by-day */}
      <div className="space-y-3">
        {dates.map((date) => {
          const dayMeals = byDate[date] ?? [];
          const dayTotal = dayMeals.reduce((sum, m) => sum + m.calories, 0);
          const over = dayTotal > goal;
          const hasData = dayMeals.length > 0;

          return (
            <div key={date} className="bg-slate-800/60 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white font-medium text-sm">{formatDate(date)}</p>
                <p className={`font-semibold text-sm ${!hasData ? "text-slate-600" : over ? "text-red-400" : "text-emerald-400"}`}>
                  {hasData ? `${dayTotal.toLocaleString()} cal` : "—"}
                </p>
              </div>
              {hasData && <ProgressBar value={dayTotal} max={goal} />}
              {hasData && (
                <div className="mt-2 space-y-1">
                  {dayMeals.map((m) => (
                    <div key={m._id} className="flex justify-between text-xs">
                      <span className="text-slate-400 truncate">{m.name}</span>
                      <span className="text-slate-500 ml-2 shrink-0">{m.calories} cal</span>
                    </div>
                  ))}
                </div>
              )}
              {!hasData && (
                <p className="text-slate-600 text-xs mt-1">No meals logged</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
