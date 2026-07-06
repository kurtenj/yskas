"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useUser } from "@/lib/user-context";
import { ArrowUp, Barbell, Bread, Check, Microphone, Stop } from "@phosphor-icons/react";
import { ShimmerText } from "./shimmer-text";
import { todayDate, getLast7Days } from "@/lib/dates";
import Fuse from "fuse.js";
import { AnimatePresence, m } from "motion/react";
import { usePathname } from "next/navigation";

interface Estimate {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function fetchEstimate(description: string): Promise<Result<Estimate>> {
  try {
    const res = await fetch("/api/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to estimate");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

async function transcribeAudio(blob: Blob): Promise<Result<string>> {
  try {
    const form = new FormData();
    form.append("audio", blob);
    const res = await fetch("/api/transcribe", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Transcription failed");
    return { ok: true, data: data.transcript };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Transcription failed" };
  }
}

function useMealSuggestions({
  userId,
  description,
  hasEstimate,
}: {
  userId: Id<"users"> | null;
  description: string;
  hasEstimate: boolean;
}) {
  const last7Days = getLast7Days();

  const recentMeals = useQuery(
    api.meals.forDateRange,
    userId ? { userId, dates: last7Days } : "skip",
  );

  const uniqueMeals = (() => {
    if (!recentMeals) return [];
    const seen = new Map<string, Doc<"meals">>();
    for (const meal of [...recentMeals].sort((a, b) => b.createdAt - a.createdAt)) {
      if (!seen.has(meal.name)) seen.set(meal.name, meal);
    }
    return Array.from(seen.values());
  })();

  const fuse = new Fuse(uniqueMeals, { keys: ["name", "description"], threshold: 0.4 });

  if (hasEstimate || description.trim().length < 2 || uniqueMeals.length === 0) return [];
  return fuse.search(description.trim()).slice(0, 3).map((r) => r.item);
}

function useVoiceRecording({
  onTranscript,
  onError,
}: {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function handleMic() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setTranscribing(true);
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || mimeType });
        const result = await transcribeAudio(blob);
        if (result.ok) {
          onTranscript(result.data);
        } else {
          onError(result.error);
        }
        setTranscribing(false);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        onError("Microphone access denied");
      } else {
        onError("Could not start recording");
      }
    }
  }

  return { recording, transcribing, handleMic };
}

function MealStatusPanel({
  busy,
  recording,
  estimate,
  setEstimate,
  error,
  suggestions,
}: {
  busy: boolean;
  recording: boolean;
  estimate: Estimate | null;
  setEstimate: (estimate: Estimate) => void;
  error: string;
  suggestions: Doc<"meals">[];
}) {
  if (busy) {
    return (
      <div className="flex items-center justify-center px-4 py-6">
        <ShimmerText />
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center justify-center px-4 py-6">
        <p className="text-red-400 text-sm">Recording — tap mic to stop</p>
      </div>
    );
  }

  if (estimate) {
    return (
      <div className="flex items-center gap-4 px-4 py-5">
        <div className="min-w-0 flex-1">
          <p className="text-mist-100 text-base truncate">{estimate.name}</p>
          {(estimate.protein !== undefined || estimate.carbs !== undefined) && (
            <div className="flex items-center gap-3 mt-1">
              {estimate.protein !== undefined && (
                <span className="flex items-center gap-1 text-mist-500 text-base">
                  <Barbell size={20} weight="fill" />
                  {estimate.protein}g
                </span>
              )}
              {estimate.carbs !== undefined && (
                <span className="flex items-center gap-1 text-mist-500 text-base">
                  <Bread size={20} weight="fill" />
                  {estimate.carbs}g
                </span>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 rounded-xl border border-mist-800 bg-mist-950 px-4 py-2.5">
          <input
            type="number"
            value={estimate.calories}
            onChange={(e) =>
              setEstimate({ ...estimate, calories: parseInt(e.target.value, 10) || 0 })
            }
            className="w-16 bg-transparent text-mist-200 text-2xl font-bold font-agdasima focus:outline-none text-center"
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-5">
        <p className="text-cyan-500 text-sm">{error}</p>
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
            onClick={() =>
              setEstimate({
                name: meal.name,
                calories: meal.calories,
                protein: meal.protein,
                carbs: meal.carbs,
                fat: meal.fat,
              })
            }
            className={`w-full flex items-center justify-between py-4 text-left ${
              i < suggestions.length - 1 ? "border-b border-mist-800/50" : ""
            }`}
          >
            <span className="text-mist-100 text-sm font-medium truncate pr-3">
              {meal.name}
            </span>
            <span className="text-mist-400 text-sm shrink-0">{meal.calories} cal</span>
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
  const addMeal = useMutation(api.meals.add);

  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { recording, transcribing, handleMic } = useVoiceRecording({
    onTranscript: (text) => setDescription(text),
    onError: (message) => setError(message),
  });

  const suggestions = useMealSuggestions({ userId, description, hasEstimate: !!estimate });

  const busy = loading || transcribing;
  const showPanel = busy || recording || !!estimate || suggestions.length > 0 || !!error;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (estimate) {
      await handleSave();
    } else {
      await submitEstimate();
    }
  }

  async function submitEstimate() {
    if (!description.trim() || busy) return;
    setError("");
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
      setDescription("");
      setEstimate(null);
      setError("");
    } finally {
      setSaving(false);
    }
  }

  const submitDisabled = !description.trim() || busy || saving;

  return (
    <m.div
      className="fixed bottom-24 left-4 right-4 z-40"
      animate={{ x: isHome ? 0 : "calc(100% + 1rem)" }}
      transition={{ type: "spring", stiffness: 350, damping: 32 }}
    >
      <form onSubmit={handleSubmit}>
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
                  recording={recording}
                  estimate={estimate}
                  setEstimate={setEstimate}
                  error={error}
                  suggestions={suggestions}
                />
              </m.div>
            )}
          </AnimatePresence>

          <div className="flex items-center pl-4 pr-2 py-2 bg-mist-900">
            <input
              type="text"
              value={description}
              onChange={(e) => {
                const val = e.target.value;
                setDescription(val);
                if (estimate) setEstimate(null);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!submitDisabled) handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder="What did you eat?"
              disabled={busy || saving}
              className="flex-1 min-w-0 bg-transparent text-mist-50 text-base focus:outline-none placeholder:text-mist-600 disabled:opacity-50 py-1.5"
            />
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button
                type="button"
                onClick={handleMic}
                disabled={busy || saving}
                aria-label={recording ? "Stop recording" : "Start voice input"}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                  recording
                    ? "bg-red-500 text-white"
                    : "text-mist-400 hover:text-mist-200"
                }`}
              >
                {recording ? <Stop size={24} weight="fill" /> : <Microphone size={24} />}
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                aria-label={estimate ? "Save meal" : "Estimate calories"}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
                  submitDisabled
                    ? "bg-mist-800 text-mist-600"
                    : estimate
                    ? "bg-[oklch(71.5%_0.143_215.2)] text-mist-950 hover:opacity-90"
                    : "bg-mist-100 text-mist-950 hover:bg-mist-200"
                }`}
              >
                {estimate ? (
                  <Check size={24} weight="bold" />
                ) : (
                  <ArrowUp size={24} weight="bold" />
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </m.div>
  );
}
