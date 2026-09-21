"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { captureLoggingTime } from "@/lib/dates";
import {
  parseEstimate,
  parseNutrition,
  type MealEstimate,
  type ESTIMATE_VERSION,
} from "@/lib/nutrition";
import { reportMealEvent, type MealEvent } from "@/lib/telemetry";
import { useVoiceRecording } from "./use-voice-recording";

type Estimate = MealEstimate & {
  description: string;
  estimate?: typeof ESTIMATE_VERSION;
  sourceId?: Id<"meals">;
};
type Phase = "idle" | "capture" | "transcribe" | "estimate" | "save" | "failed";
type Operation = {
  id: string;
  mode: MealEvent["mode"];
  controller: AbortController;
  logging: ReturnType<typeof captureLoggingTime>;
  started: number;
  stageStarted: number;
  attempt: number;
  events: MealEvent[];
  estimate?: Estimate;
  phase: Phase;
};

export function useMealEntry(
  userId: Id<"users"> | null,
  enabled: boolean,
  onSaved: () => void,
) {
  const add = useMutation(api.meals.add);
  const reuse = useMutation(api.meals.reuse);
  const active = useRef<Operation | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [description, updateDescription] = useState("");
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  function event(
    op: Operation,
    stage: MealEvent["stage"],
    outcome: MealEvent["outcome"],
    durationMs = 0,
  ) {
    op.events.push({
      operationId: op.id,
      mode: op.mode,
      stage,
      outcome,
      durationMs,
      attempt: op.attempt,
    });
    // Usually one telemetry request per meal, rather than one per stage.
    if (
      (stage === "operation" && outcome !== "reuse") ||
      !["success", "reuse", "retry"].includes(outcome) ||
      op.events.length >= 8 ||
      op.controller.signal.aborted
    ) {
      reportMealEvent(op.events.splice(0, 8));
    }
  }
  function current(op: Operation) {
    return active.current === op && !op.controller.signal.aborted;
  }
  function transition(op: Operation, next: Phase) {
    op.phase = next;
    op.stageStarted = performance.now();
    setPhase(next);
  }
  function cancel() {
    const op = active.current;
    if (!op) return;
    op.controller.abort();
    active.current = null;
    event(op, "operation", "abandoned", performance.now() - op.started);
  }
  // Route/profile changes unmount this hook. Capture stops on backgrounding;
  // already submitted requests continue while hidden, as in the voice hook.
  useEffect(() => {
    function background() {
      if (document.hidden && active.current?.phase === "capture") {
        cancel();
        setPhase("idle");
        setEstimate(null);
      }
    }
    document.addEventListener("visibilitychange", background);
    return () => {
      document.removeEventListener("visibilitychange", background);
      cancel();
    };
  }, [userId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  function begin(mode: Operation["mode"]): Operation | null {
    if (
      !userId ||
      !enabled ||
      (active.current && active.current.phase !== "failed")
    )
      return null;
    cancel();
    const op: Operation = {
      id: crypto.randomUUID(),
      mode,
      controller: new AbortController(),
      logging: captureLoggingTime(),
      started: performance.now(),
      stageStarted: performance.now(),
      attempt: 0,
      events: [],
      phase: "idle",
    };
    active.current = op;
    setError("");
    setSavedMessage("");
    setEstimate(null);
    return op;
  }
  function fail(op: Operation, message: string) {
    if (!current(op)) return;
    transition(op, "failed");
    setError(message);
  }
  function headers(op: Operation) {
    return { "x-operation-id": op.id, "x-input-mode": op.mode };
  }
  async function estimateText(op: Operation, text: string) {
    if (!current(op)) return;
    transition(op, "estimate");
    const response = await fetch("/api/estimate", {
      method: "POST",
      headers: { ...headers(op), "Content-Type": "application/json" },
      body: JSON.stringify({ description: text }),
      signal: op.controller.signal,
    });
    const data = await response.json();
    if (!current(op)) return;
    event(
      op,
      "estimate",
      response.ok ? "success" : "provider_error",
      performance.now() - op.stageStarted,
    );
    if (!response.ok) throw new Error(data.error || "Failed to estimate");
    op.estimate = {
      ...parseEstimate(data),
      description: text,
      estimate: data.estimate,
    };
    setEstimate(op.estimate);
    await save(op);
  }
  async function save(op: Operation) {
    if (!current(op) || !op.estimate || !userId || op.phase === "save") return;
    if (op.attempt) event(op, "save", "retry");
    op.attempt++;
    transition(op, "save");
    const meal = op.estimate;
    try {
      const nutrition = parseNutrition(meal);
      const common = { userId, operationId: op.id, ...op.logging };
      if (meal.sourceId)
        await reuse({
          ...common,
          sourceId: meal.sourceId,
          correction: {
            ...nutrition,
            protein: nutrition.protein ?? null,
            fiber: nutrition.fiber ?? null,
            carbs: nutrition.carbs ?? null,
            fat: nutrition.fat ?? null,
          },
        });
      else
        await add({
          ...common,
          description: meal.description,
          name: meal.name,
          ...nutrition,
          originalNutrition: nutrition,
          estimate: meal.estimate,
        });
      event(op, "save", "success", performance.now() - op.stageStarted);
      if (!current(op)) return;
      event(op, "operation", "success", performance.now() - op.started);
      active.current = null;
      setPhase("idle");
      setEstimate(null);
      updateDescription("");
      setError("");
      setSavedMessage(`Logged ${meal.name}`);
      onSaved();
    } catch {
      event(op, "save", "save_error", performance.now() - op.stageStarted);
      fail(
        op,
        "Could not save your meal. Tap Retry to save without estimating again.",
      );
    }
  }
  const voice = useVoiceRecording({
    enabled: enabled && !!userId,
    onAudio: async (audio, signal) => {
      const op = active.current;
      if (!op || !current(op) || op.mode !== "voice") return;
      event(op, "capture", "success", performance.now() - op.started);
      transition(op, "transcribe");
      try {
        const body = new FormData();
        body.append("audio", audio);
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body,
          headers: headers(op),
          signal: AbortSignal.any([signal, op.controller.signal]),
        });
        const data = await response.json();
        event(
          op,
          "transcribe",
          response.ok ? "success" : "provider_error",
          performance.now() - op.stageStarted,
        );
        if (!current(op) || signal.aborted) return;
        if (!response.ok) throw new Error(data.error || "Transcription failed");
        const text =
          typeof data.transcript === "string" ? data.transcript.trim() : "";
        if (!text) throw new Error("No speech heard. Please try again.");
        updateDescription(text);
        await estimateText(op, text);
      } catch (error) {
        fail(
          op,
          error instanceof Error ? error.message : "Transcription failed",
        );
      }
    },
    onError: (message) => {
      const op = active.current;
      if (op) {
        event(op, "capture", "rejected", performance.now() - op.started);
        fail(op, message);
      }
    },
  });
  async function handleMic() {
    if (voice.recording) {
      await voice.handleMic();
      return;
    }
    const op = begin("voice");
    if (!op) return;
    transition(op, "capture");
    await voice.handleMic();
  }
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const pending = active.current;
    if (pending?.phase === "failed" && pending.estimate) {
      await save(pending);
      return;
    }
    if (!description.trim()) return;
    const op = begin("text");
    if (!op) return;
    try {
      await estimateText(op, description.trim());
    } catch (error) {
      fail(op, error instanceof Error ? error.message : "Failed to estimate");
    }
  }
  async function selectMeal(meal: Doc<"meals">) {
    const op = begin("reuse");
    if (!op) return;
    updateDescription(meal.description);
    op.estimate = {
      ...parseEstimate(meal),
      description: meal.description,
      sourceId: meal._id,
    };
    setEstimate(op.estimate);
    event(op, "operation", "reuse");
    await save(op);
  }
  function setDescription(text: string) {
    if (active.current && active.current.phase !== "failed") return;
    cancel();
    setPhase("idle");
    setEstimate(null);
    setError("");
    setSavedMessage("");
    updateDescription(text);
  }
  return {
    description,
    setDescription,
    estimate,
    error,
    savedMessage,
    busy: ["transcribe", "estimate", "save"].includes(phase) || voice.starting,
    saving: phase === "save",
    recording: voice.recording,
    status: voice.starting
      ? "Starting microphone..."
      : phase === "transcribe"
        ? "Transcribing..."
        : phase === "estimate"
          ? "Estimating meal..."
          : "Saving meal...",
    handleSubmit,
    selectMeal,
    handleMic,
  };
}
