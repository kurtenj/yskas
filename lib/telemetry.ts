import { operationPattern } from "./operation";

export const stages = [
  "capture",
  "transcribe",
  "estimate",
  "save",
  "operation",
] as const;
export const outcomes = [
  "success",
  "rejected",
  "refused",
  "truncated",
  "invalid",
  "timeout",
  "cancelled",
  "provider_error",
  "save_error",
  "abandoned",
  "retry",
  "reuse",
] as const;
export type MealEvent = {
  operationId: string;
  mode: "text" | "voice" | "reuse";
  stage: (typeof stages)[number];
  outcome: (typeof outcomes)[number];
  durationMs: number;
  attempt: number;
};

/** Explicit allowlist: never serialize arbitrary caller/provider objects. */
export function parseMealEvent(value: unknown): MealEvent {
  if (!value || typeof value !== "object") throw new Error("Invalid event");
  const v = value as Record<string, unknown>;
  if (
    typeof v.operationId !== "string" ||
    !operationPattern.test(v.operationId) ||
    !["text", "voice", "reuse"].includes(String(v.mode)) ||
    !stages.includes(v.stage as MealEvent["stage"]) ||
    !outcomes.includes(v.outcome as MealEvent["outcome"]) ||
    typeof v.durationMs !== "number" ||
    !Number.isFinite(v.durationMs) ||
    v.durationMs < 0 ||
    v.durationMs > 86_400_000 ||
    typeof v.attempt !== "number" ||
    !Number.isInteger(v.attempt) ||
    v.attempt < 0 ||
    v.attempt > 1000
  )
    throw new Error("Invalid event");
  return {
    operationId: v.operationId,
    mode: v.mode as MealEvent["mode"],
    stage: v.stage as MealEvent["stage"],
    outcome: v.outcome as MealEvent["outcome"],
    durationMs: Math.round(v.durationMs),
    attempt: v.attempt,
  };
}

export function requestContext(request: Request) {
  const candidate = request.headers.get("x-operation-id") ?? "";
  return {
    operationId: operationPattern.test(candidate)
      ? candidate
      : crypto.randomUUID(),
    mode:
      request.headers.get("x-input-mode") === "voice"
        ? ("voice" as const)
        : ("text" as const),
  };
}

export function emitMealEvent(
  event: MealEvent,
  provider?: {
    model: string;
    promptVersion: string;
    schemaVersion: number;
    inputTokens: number | null;
    outputTokens: number | null;
    cachedTokens: number | null;
  },
) {
  console.info(
    JSON.stringify({
      event: "meal_entry",
      version: 1,
      at: new Date().toISOString(),
      source: "server",
      ...parseMealEvent(event),
      ...(provider
        ? {
            provider: {
              model: provider.model,
              promptVersion: provider.promptVersion,
              schemaVersion: provider.schemaVersion,
              inputTokens: provider.inputTokens,
              outputTokens: provider.outputTokens,
              cachedTokens: provider.cachedTokens,
            },
          }
        : {}),
    }),
  );
}

export function reportMealEvent(event: MealEvent | MealEvent[]) {
  // Best effort, no retry loop, no dependency of logging success on telemetry.
  try {
    void fetch("/api/meal-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: (Array.isArray(event) ? event : [event])
          .slice(0, 8)
          .map(parseMealEvent),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Validation or keepalive limits must never interfere with a save. */
  }
}
