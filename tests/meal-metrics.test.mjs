import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../scripts/meal-metrics.mjs";
test("mixed model costs retain historical rates and charge Luna cached tokens", () => {
  const event = { event: "meal_entry", version: 1, source: "server", stage: "estimate", attempt: 1 };
  const provider = { inputTokens: 100, outputTokens: 50, cachedTokens: 40 };
  const report = summarize([
    { ...event, provider: { ...provider, model: "gpt-4o-mini" } },
    { ...event, provider: { ...provider, model: "gpt-5.6-luna" } },
  ]);
  assert.ok(Math.abs(report.textCostUsd - 0.0001148) < 1e-10);
  assert.equal(report.attemptsMissingUsage, 0);
  assert.equal(summarize([{ ...event, provider: { ...provider, model: "unknown" } }]).textCostUsd, null);
});
test("metrics do not call missing usage or missing accepted meals zero", () => {
  const report = summarize([
    {
      event: "meal_entry",
      version: 1,
      source: "server",
      stage: "estimate",
      attempt: 1,
      outcome: "provider_error",
    },
  ]);
  assert.equal(report.textCostUsd, null);
  assert.equal(report.callsPerAcceptedMeal, null);
  assert.equal(report.attemptsMissingUsage, 1);
  assert.equal(report.stages.estimate.p95Ms, null);
});
test("metrics separate transcription and count retry successes once", () => {
  const base = {
    event: "meal_entry",
    version: 1,
    operationId: "op",
    outcome: "success",
    attempt: 1,
    durationMs: 100,
  };
  const report = summarize([
    {
      ...base,
      source: "server",
      stage: "estimate",
      provider: {
        model: "gpt-4o-mini",
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 0,
      },
    },
    { ...base, source: "server", stage: "transcribe" },
    { ...base, source: "client", stage: "save" },
    { ...base, source: "client", stage: "save", attempt: 2 },
  ]);
  assert.equal(report.callsPerAcceptedMeal, 2);
  assert.equal(report.transcriptionAttempts, 1);
  assert.equal(report.transcriptionCostUsd, null);
  assert.ok(Math.abs(report.textCostUsd - 0.000045) < 1e-10);
});
