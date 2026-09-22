/** Explicitly budgeted offline comparison. Never writes meals or changes production. */
import { loadEnvConfig } from "@next/env";
import OpenAI from "openai";
import { mkdir, writeFile } from "node:fs/promises";
import { ESTIMATE_PROMPT, nutritionSchema } from "../lib/estimator";
import { ESTIMATE_VERSION, parseEstimate } from "../lib/nutrition";
import { fixtures, grade } from "../evals/luna-fixtures";

const models = ["gpt-4o-mini", "gpt-5.6-luna"] as const;
const prices = { "gpt-4o-mini": [0.15, 0.075, 0.6], "gpt-5.6-luna": [0.2, 0.02, 1.2] };
async function main() {
  const budget = Number(process.argv.find((arg) => arg.startsWith("--budget="))?.split("=")[1]);
  if (!process.argv.includes("--run")) {
    console.log(JSON.stringify({ mode: "offline", fixtures: fixtures.length, plannedRequests: fixtures.length * 4, models, note: "Pass --run --budget=0.10 to call providers." }));
    return;
  }
  if (!Number.isFinite(budget) || budget <= 0 || budget > 0.1) throw new Error("Set a budget above zero and at most $0.10.");
  loadEnvConfig(process.cwd());
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 45_000 });
  const rows: Record<string, unknown>[] = [];
  let spent = 0;
  await mkdir(".convex", { recursive: true });
  const report = { measuredAt: new Date().toISOString(), fixtureVersion: 1, referenceRetrieved: "2026-09-21", prompt: ESTIMATE_PROMPT, version: ESTIMATE_VERSION, prices, budgetUsd: budget, rounds: 2, rows };
  const persist = () => writeFile(".convex/luna-comparison.json", JSON.stringify({ ...report, knownCostUsd: spent }, null, 2) + "\n");
  for (let round = 0; round < 2; round++) for (const [index, fixture] of fixtures.entries()) {
    for (const model of (index + round) % 2 ? [...models].reverse() : models) {
      const [inputRate, cachedRate, outputRate] = prices[model];
      const messages = [{ role: "system" as const, content: ESTIMATE_PROMPT }, { role: "user" as const, content: fixture.input }];
      // Small ASCII fixtures + schema are under 4096 bytes. Reserve 8192 input
      // tokens and the full 256 output cap; stop on missing usage/errors.
      if (Buffer.byteLength(JSON.stringify({ messages, nutritionSchema })) > 4096) throw new Error("Input reservation exceeded");
      const reserve = (8192 * inputRate + 256 * outputRate) / 1e6;
      if (spent + reserve > budget) throw new Error("Budget exhausted before request");
      const started = performance.now();
      let response;
      try {
        response = await client.chat.completions.create({ model, messages,
          ...(model === "gpt-4o-mini" ? { temperature: 0.2, max_tokens: 256 } : { reasoning_effort: "none" as const, max_completion_tokens: 256 }),
          response_format: { type: "json_schema", json_schema: { name: "nutrition", strict: true, schema: nutritionSchema } },
        });
      } catch (error) {
        rows.push({ model, fixture: fixture.id, round, outcome: "provider_error", status: error instanceof OpenAI.APIError ? error.status : null, code: error instanceof OpenAI.APIError ? error.code : null, costUsd: null });
        await persist();
        throw new Error("Provider request failed; no retries. See safe report status/code.");
      }
      const usage = response.usage;
      const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
      const cost = usage ? ((usage.prompt_tokens - cached) * inputRate + cached * cachedRate + usage.completion_tokens * outputRate) / 1e6 : null;
      if (cost !== null) spent += cost;
      const choice = response.choices[0];
      let meal = null;
      let outcome = "invalid";
      try {
        if (choice?.finish_reason !== "stop" || choice.message.refusal) throw new Error();
        const raw = JSON.parse(choice.message.content ?? "");
        if (Object.keys(raw).length !== 6 || nutritionSchema.required.some((key) => !(key in raw))) throw new Error();
        meal = parseEstimate(raw);
        outcome = "success";
      } catch { /* Report invalid/refused/truncated responses without dropping them. */ }
      rows.push({ model, responseModel: response.model, fixture: fixture.id, category: fixture.category, round, outcome, durationMs: Math.round(performance.now() - started), usage, costUsd: cost, meal, scores: meal ? grade(fixture, meal) : null });
      await persist();
      console.log(`${rows.length}/${fixtures.length * 4}: ${model} ${fixture.id} ${outcome}`);
      if (cost === null || usage!.prompt_tokens > 8192 || cost > reserve) throw new Error("Usage reservation cannot be verified; stopping");
    }
  }
  console.log(`Completed. Total measured token cost: $${spent.toFixed(6)}. Report: .convex/luna-comparison.json`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
