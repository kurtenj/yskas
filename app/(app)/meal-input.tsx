"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useUser } from "@/lib/user-context";
import { ArrowUp, Microphone, Stop } from "@phosphor-icons/react";
import { useMealEntry } from "./use-meal-entry";
import { getLast7Days } from "@/lib/dates";
import { useLoggingDay } from "@/lib/use-logging-day";
import { mealReuseKey, formatQuantity } from "@/lib/nutrition";
import Fuse from "fuse.js";
import { AnimatePresence, m } from "motion/react";
import { usePathname } from "next/navigation";

function useMealSuggestions({
  userId,
  description,
  enabled,
}: {
  userId: Id<"users"> | null;
  description: string;
  enabled: boolean;
}) {
  const day = useLoggingDay();
  const last7Days = getLast7Days(day);

  const recentMeals = useQuery(
    api.meals.forDateRange,
    userId && enabled && description.trim().length >= 2
      ? { userId, dates: last7Days }
      : "skip",
  );

  const uniqueMeals = (() => {
    if (!recentMeals) return [];
    const seen = new Map<string, Doc<"meals">>();
    for (const meal of recentMeals.toSorted(
      (a, b) => b.createdAt - a.createdAt,
    )) {
      const key = mealReuseKey(meal);
      if (!seen.has(key)) seen.set(key, meal);
    }
    return Array.from(seen.values());
  })();

  const fuse = new Fuse(uniqueMeals, {
    keys: ["name", "description"],
    threshold: 0.4,
  });

  if (!enabled || description.trim().length < 2 || uniqueMeals.length === 0)
    return [];
  return fuse
    .search(description.trim())
    .slice(0, 3)
    .map((r) => r.item);
}

function MealStatusPanel({
  busy,
  status,
  recording,
  error,
  suggestions,
  onSelect,
}: {
  busy: boolean;
  status: string;
  recording: boolean;
  error: string;
  suggestions: Doc<"meals">[];
  onSelect: (meal: Doc<"meals">) => void;
}) {
  if (busy) {
    return (
      <div className="flex items-center justify-center px-4 py-6">
        <p role="status" className="text-mist-300 text-sm">
          {status}
        </p>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center justify-center px-4 py-6">
        <p role="status" className="text-red-400 text-sm">
          Listening... pause when finished, or tap stop
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-5">
        <p role="alert" className="text-cyan-500 text-sm">
          {error}
        </p>
      </div>
    );
  }

  if (suggestions.length > 0) {
    return (
      <div className="px-4 py-2">
        {suggestions.map((meal, i) => (
          <button
            key={meal._id}
            type="button"
            onClick={() => onSelect(meal)}
            className={`w-full flex items-center justify-between py-4 text-left ${
              i < suggestions.length - 1 ? "border-b border-mist-800/50" : ""
            }`}
          >
            <span className="text-mist-100 text-sm font-medium truncate pr-3">
              {meal.name}
              <span className="block text-xs text-mist-500 truncate">
                {meal.description} /{" "}
                {meal.provenance?.servingMultiplier &&
                meal.provenance.servingMultiplier !== 1
                  ? `${formatQuantity(meal.provenance.servingMultiplier)}× original portion`
                  : "Same portion"}
              </span>
            </span>
            <span className="text-mist-400 text-sm shrink-0">
              {formatQuantity(meal.calories)} cal
            </span>
          </button>
        ))}
      </div>
    );
  }

  return null;
}

export function MealInput() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const { userId } = useUser();
  const [focused, setFocused] = useState(false);
  const {
    description,
    setDescription,
    estimate,
    error,
    savedMessage,
    busy,
    status,
    recording,
    saving,
    handleSubmit,
    selectMeal,
    handleMic,
  } = useMealEntry(userId, isHome, () => setFocused(false));
  const suggestions = useMealSuggestions({
    userId,
    description,
    enabled: !estimate && !busy && !recording,
  });
  const showPanel =
    busy || recording || !!estimate || suggestions.length > 0 || !!error;
  const submitDisabled = !description.trim() || busy || recording;

  function handleBlurCapture(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setFocused(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {focused && isHome && (
          <m.div
            key="input-overlay"
            className="fixed inset-0 z-30 bg-mist-950/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() =>
              (document.activeElement as HTMLElement | null)?.blur()
            }
          />
        )}
      </AnimatePresence>
      <m.div
        className="fixed bottom-6 left-4 right-4 z-40"
        animate={{ x: isHome ? 0 : "calc(100% + 1rem)" }}
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={handleBlurCapture}
      >
        <form onSubmit={handleSubmit}>
          {savedMessage && !showPanel && (
            <p role="status" className="mb-2 text-center text-sm text-mist-200">
              {savedMessage}
            </p>
          )}
          <div className="rounded-2xl border border-mist-800 overflow-hidden shadow-lg">
            <AnimatePresence>
              {showPanel && (
                <m.div
                  key="panel"
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="overflow-hidden bg-mist-900/50 border-b border-mist-800"
                >
                  <MealStatusPanel
                    busy={busy}
                    status={status}
                    recording={recording}
                    error={error}
                    suggestions={suggestions}
                    onSelect={selectMeal}
                  />
                </m.div>
              )}
            </AnimatePresence>

            <div className="flex items-center pl-4 pr-2 py-2 bg-mist-900">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!submitDisabled)
                      handleSubmit(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="What did you eat?"
                aria-label="What did you eat?"
                disabled={busy || recording}
                className="flex-1 min-w-0 bg-transparent text-mist-50 text-base focus:outline-none placeholder:text-mist-600 disabled:opacity-50 py-1.5"
              />
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => void handleMic()}
                  disabled={busy || saving}
                  aria-label={
                    recording ? "Finish and log meal" : "Log meal with voice"
                  }
                  className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                    recording
                      ? "bg-red-500 text-white"
                      : "text-mist-400 hover:text-mist-200"
                  }`}
                >
                  {recording ? (
                    <Stop size={24} weight="fill" />
                  ) : (
                    <Microphone size={24} />
                  )}
                </button>
                <button
                  type="submit"
                  disabled={submitDisabled}
                  aria-label={estimate ? "Retry saving meal" : "Log meal"}
                  className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
                    submitDisabled
                      ? "bg-mist-800 text-mist-600"
                      : estimate
                        ? "bg-[oklch(71.5%_0.143_215.2)] text-mist-950 hover:opacity-90"
                        : "bg-mist-100 text-mist-950 hover:bg-mist-200"
                  }`}
                >
                  <ArrowUp size={24} weight="bold" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </m.div>
    </>
  );
}
