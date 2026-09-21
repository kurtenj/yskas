import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const pricing = {
  date: "2026-09-21",
  model: "gpt-4o-mini",
  inputPerMillion: 0.15,
  cachedInputPerMillion: 0.075,
  outputPerMillion: 0.6,
  source: "https://developers.openai.com/api/docs/models/gpt-4o-mini",
};
const percentile = (values, p) =>
  values.length
    ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]
    : null;
export function summarize(events) {
  events = events.filter((e) => e.event === "meal_entry" && e.version === 1);
  const accepted = new Set(
    events
      .filter((e) => e.stage === "save" && e.outcome === "success")
      .map((e) => e.operationId),
  );
  const attempts = events.filter(
    (e) =>
      e.source === "server" &&
      ["estimate", "transcribe"].includes(e.stage) &&
      e.attempt > 0,
  );
  const estimates = attempts.filter((e) => e.stage === "estimate");
  let textCost = 0,
    missingUsage = 0,
    inputTokens = 0,
    outputTokens = 0;
  for (const e of estimates) {
    const u = e.provider;
    if (
      u?.model !== pricing.model ||
      u?.inputTokens == null ||
      u?.outputTokens == null
    ) {
      missingUsage++;
      continue;
    }
    // Missing cache detail: conservatively charge the standard input rate.
    const cached = Math.min(u.inputTokens, u.cachedTokens ?? 0);
    inputTokens += u.inputTokens;
    outputTokens += u.outputTokens;
    textCost +=
      ((u.inputTokens - cached) * pricing.inputPerMillion +
        cached * pricing.cachedInputPerMillion +
        u.outputTokens * pricing.outputPerMillion) /
      1e6;
  }
  const stages = {};
  for (const stage of [
    "capture",
    "transcribe",
    "estimate",
    "save",
    "operation",
  ]) {
    const source = ["transcribe", "estimate"].includes(stage)
      ? "server"
      : "client";
    const samples = events
      .filter(
        (e) =>
          e.stage === stage && e.source === source && e.outcome === "success",
      )
      .map((e) => e.durationMs);
    stages[stage] = {
      samples: samples.length,
      p50Ms: percentile(samples, 0.5),
      p95Ms: percentile(samples, 0.95),
    };
  }
  return {
    events: events.length,
    acceptedMealsObserved: accepted.size,
    providerAttempts: attempts.length,
    estimationAttempts: estimates.length,
    transcriptionAttempts: attempts.length - estimates.length,
    callsPerAcceptedMeal: accepted.size
      ? attempts.length / accepted.size
      : null,
    textCostUsd: estimates.length && !missingUsage ? textCost : null,
    knownTextCostUsd: textCost,
    attemptsMissingUsage: missingUsage,
    knownInputTokens: inputTokens,
    knownOutputTokens: outputTokens,
    transcriptionCostUsd: null,
    pricing,
    stages,
    limitations:
      "Client outcomes are best-effort observations, not billing records. Missing outcomes are not assumed abandoned. Transcription cost requires ElevenLabs billing data. Small samples do not establish production p95.",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.argv[2])
    throw new Error("Usage: node scripts/meal-metrics.mjs events.jsonl");
  const input = await readFile(process.argv[2], "utf8");
  const events = input
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const value = JSON.parse(line);
        return [
          typeof value.message === "string" ? JSON.parse(value.message) : value,
        ];
      } catch {
        return [];
      }
    });
  console.log(JSON.stringify(summarize(events), null, 2));
}
