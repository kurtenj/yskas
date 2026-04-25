"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/lib/user-context";
import { useRouter } from "next/navigation";
import { Button } from "@base-ui/react/button";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { ArrowRight, Microphone, Stop } from "@phosphor-icons/react";
import { ShimmerText } from "./shimmer-text";
import { todayDate, getLast7Days } from "@/lib/dates";
import Fuse from "fuse.js";

interface Estimate {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
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
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const last7Days = useMemo(() => getLast7Days(), []);

  const recentMeals = useQuery(
    api.meals.forDateRange,
    userId ? { userId, dates: last7Days } : "skip",
  );

  const uniqueMeals = useMemo(() => {
    if (!recentMeals) return [];
    const seen = new Map<string, (typeof recentMeals)[0]>();
    for (const meal of [...recentMeals].sort(
      (a, b) => b.createdAt - a.createdAt,
    )) {
      if (!seen.has(meal.name)) seen.set(meal.name, meal);
    }
    return Array.from(seen.values());
  }, [recentMeals]);

  const fuse = useMemo(
    () =>
      new Fuse(uniqueMeals, { keys: ["name", "description"], threshold: 0.4 }),
    [uniqueMeals],
  );

  const suggestions = useMemo(() => {
    if (description.trim().length < 2 || uniqueMeals.length === 0) return [];
    return fuse
      .search(description.trim())
      .slice(0, 3)
      .map((r) => r.item);
  }, [description, fuse, uniqueMeals]);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function submitEstimate() {
    if (!description.trim() || loading) return;
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

  function handleEstimate(e: React.FormEvent) {
    e.preventDefault();
    submitEstimate();
  }

  async function handleMic() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
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

        try {
          const blob = new Blob(chunks, {
            type: mediaRecorder.mimeType || mimeType,
          });
          const form = new FormData();
          form.append("audio", blob);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Transcription failed");
          setDescription(data.transcript);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone access denied");
      } else {
        setError("Could not start recording");
      }
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

  const busy = loading || transcribing;

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-mist-50 mb-1">Log a Meal</h1>
      <p className="text-mist-400 text-sm mb-6">
        Describe what you ate in plain language
      </p>

      {!estimate ? (
        <form onSubmit={handleEstimate} className="space-y-4">
          <div className="relative bg-mist-900 border border-mist-800 rounded-2xl focus-within:border-mist-600 transition-colors">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. two slices of whole wheat toast with peanut butter and a banana"
              rows={3}
              disabled={busy}
              className="w-full bg-transparent text-mist-50 px-4 pt-4 pb-14 focus:outline-none resize-none placeholder:text-mist-600 text-sm leading-relaxed disabled:opacity-50"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitEstimate();
                }
              }}
            />

            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleMic}
                disabled={busy}
                aria-label={recording ? "Stop recording" : "Start voice input"}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                  recording
                    ? "bg-red-500 text-white"
                    : "text-mist-400 hover:text-mist-200 hover:bg-mist-800"
                }`}
              >
                {recording ? (
                  <Stop size={20} weight="fill" />
                ) : (
                  <Microphone size={20} />
                )}
              </button>

              <button
                type="submit"
                disabled={!description.trim() || busy}
                aria-label="Estimate calories"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-mist-100 hover:bg-mist-200 disabled:bg-mist-800 disabled:text-mist-600 text-mist-950 transition-colors"
              >
                <ArrowRight size={20} weight="bold" />
              </button>
            </div>
          </div>

          {busy && (
            <div className="flex items-center justify-center py-2">
              <ShimmerText />
            </div>
          )}

          {recording && (
            <p className="text-center text-red-400 text-xs">
              Recording — tap the mic to stop
            </p>
          )}

          {suggestions.length > 0 && !busy && (
            <div className="space-y-1.5">
              {suggestions.map((meal) => (
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
                  className="w-full text-left bg-mist-900/50 hover:bg-mist-900 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-mist-100 text-sm font-medium truncate pr-3">
                      {meal.name}
                    </span>
                    <span className="text-mist-400 text-sm shrink-0">
                      {meal.calories} cal
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="border border-cyan-900 bg-cyan-950 rounded-xl px-4 py-3">
              <p className="text-cyan-500 text-sm">{error}</p>
            </div>
          )}
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-mist-900 rounded-xl px-4 py-3">
            <p className="text-mist-500 text-xs uppercase tracking-wide mb-1">
              You described
            </p>
            <p className="text-mist-50 text-sm">{description}</p>
          </div>

          <div className="bg-mist-900 border border-mist-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-mist-500 text-xs uppercase tracking-wide mb-1">
                  Estimated meal
                </p>
                <h2 className="text-mist-50 text-lg font-semibold">
                  {estimate.name}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-mist-50">
                  {estimate.calories}
                </p>
                <p className="text-mist-500 text-xs">calories</p>
              </div>
            </div>

            {(estimate.protein !== undefined ||
              estimate.carbs !== undefined ||
              estimate.fat !== undefined) && (
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-mist-800">
                {estimate.protein !== undefined && (
                  <div className="text-center">
                    <p className="text-mist-50 font-semibold">
                      {estimate.protein}g
                    </p>
                    <p className="text-mist-500 text-xs">Protein</p>
                  </div>
                )}
                {estimate.carbs !== undefined && (
                  <div className="text-center">
                    <p className="text-mist-50 font-semibold">
                      {estimate.carbs}g
                    </p>
                    <p className="text-mist-500 text-xs">Carbs</p>
                  </div>
                )}
                {estimate.fat !== undefined && (
                  <div className="text-center">
                    <p className="text-mist-50 font-semibold">
                      {estimate.fat}g
                    </p>
                    <p className="text-mist-500 text-xs">Fat</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-mist-600 text-xs text-center">
            AI estimates may vary. Edit calories below if needed.
          </p>

          <Field.Root>
            <Field.Label className="block text-mist-500 text-xs uppercase tracking-wide mb-1.5">
              Adjust calories (optional)
            </Field.Label>
            <Input
              type="number"
              value={estimate.calories}
              onChange={(e) =>
                setEstimate({
                  ...estimate,
                  calories: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-full bg-mist-900 text-mist-50 rounded-xl px-4 py-3 border border-mist-800 focus:outline-none focus:border-mist-400 text-center text-xl font-bold"
            />
          </Field.Root>

          <div className="flex gap-3">
            <Button
              onClick={handleReset}
              className="flex-1 bg-mist-800 hover:bg-mist-700 text-mist-200 rounded-xl py-4 font-medium transition-colors"
            >
              Re-enter
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-mist-100 hover:bg-mist-200 disabled:bg-mist-800 disabled:text-mist-600 text-mist-950 rounded-xl py-4 font-semibold transition-colors"
            >
              {saving ? "Saving..." : "Save meal"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
