/** Explicit opt-in developer benchmark: twelve paid requests, synthetic meals only. */
import { loadEnvConfig } from "@next/env";
import OpenAI from "openai";
import { writeFile } from "node:fs/promises";
import { estimateMeal } from "../lib/estimator";
import { parseEstimate } from "../lib/nutrition";
import baseline from "./estimator-baseline.json";

const fixtures = [
  "One medium apple",
  "Two large boiled eggs",
  "One cup cooked black beans",
  "250 ml whole milk with 30 g whey protein powder",
  "One sandwich with two slices whole wheat bread and 100 g turkey",
  "One bar: label says 210 calories, 20 g protein, 7 g fiber, 23 g carbs, 8 g fat",
];
async function main() {
  if (!process.argv.includes("--run"))
    throw new Error("Pass --run to authorize twelve provider requests.");
  loadEnvConfig(process.cwd());
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 45_000 });
  const events: Record<string, unknown>[] = [];
  for (const [index, description] of fixtures.entries()) {
    // Alternate order to reduce, not eliminate, warm-up/order bias.
    for (const variant of index % 2
      ? ["strict", "legacy"]
      : ["legacy", "strict"]) {
      const started = performance.now();
      const operationId = crypto.randomUUID();
      if (variant === "legacy") {
        const response = await client.chat.completions.create({
          model: baseline.model,
          temperature: 0.2,
          max_tokens: baseline.maxTokens,
          messages: [
            { role: "system", content: baseline.prompt },
            { role: "user", content: description },
          ],
        });
        let outcome = "invalid";
        try {
          parseEstimate(JSON.parse(response.choices[0]?.message.content ?? ""));
          outcome = "success";
        } catch {}
        events.push({
          event: "meal_entry",
          version: 1,
          source: "server",
          operationId,
          variant,
          fixture: index,
          mode: "text",
          stage: "estimate",
          attempt: 1,
          outcome,
          durationMs: Math.round(performance.now() - started),
          provider: {
            model: baseline.model,
            promptVersion: baseline.promptVersion,
            schemaVersion: baseline.schemaVersion,
            inputTokens: response.usage?.prompt_tokens ?? null,
            outputTokens: response.usage?.completion_tokens ?? null,
            cachedTokens:
              response.usage?.prompt_tokens_details?.cached_tokens ?? null,
          },
        });
      } else {
        const original = console.info;
        console.info = (line: string) => {
          events.push({ ...JSON.parse(line), variant, fixture: index });
        };
        try {
          await estimateMeal(
            description,
            apiKey,
            new AbortController().signal,
            { operationId, mode: "text" },
          );
        } finally {
          console.info = original;
        }
      }
      console.log(
        `Completed ${variant} fixture ${index + 1}/${fixtures.length}`,
      );
      await writeFile(
        ".convex/estimator-benchmark.jsonl",
        events.map((e) => JSON.stringify(e)).join("\n") + "\n",
      );
    }
  }
}
main().catch(() => {
  console.error(
    "Benchmark stopped; inspect provider access/configuration. No automatic retries.",
  );
  process.exitCode = 1;
});
