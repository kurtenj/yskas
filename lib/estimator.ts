import "server-only";
import OpenAI from "openai";
import { ESTIMATE_VERSION, parseEstimate } from "./nutrition";
import { emitMealEvent, type MealEvent } from "./telemetry";

export const ESTIMATE_DEADLINE_MS = 45_000;
export const ESTIMATE_OUTPUT_TOKENS = 256;
export const nutritionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    calories: { type: "number" },
    protein: { type: ["number", "null"] },
    fiber: { type: ["number", "null"] },
    carbs: { type: ["number", "null"] },
    fat: { type: ["number", "null"] },
  },
  required: ["name", "calories", "protein", "fiber", "carbs", "fat"],
};
export const ESTIMATE_PROMPT = `Estimate nutrition for the meal described. Preserve explicit portions, units, and nutrition-label values. For unspecified portions use typical US servings. Return a short meal name (3-6 words), calories in kcal, and protein, fiber, carbs and fat in grams. Values must be nonnegative; preserve decimals. Use null for an unknown nutrient, never invent zero. Return only the requested JSON fields; no explanations.`;

export class EstimatorError extends Error {
  constructor(readonly category: MealEvent["outcome"]) {
    super("Failed to estimate calories. Please try again.");
  }
}
export function providerFailure(
  error: unknown,
  caller: AbortSignal,
  deadline: AbortSignal,
): MealEvent["outcome"] {
  if (caller.aborted) return "cancelled";
  if (
    deadline.aborted ||
    (error instanceof Error &&
      ["TimeoutError", "APIConnectionTimeoutError"].includes(error.name))
  )
    return "timeout";
  return error instanceof EstimatorError ? error.category : "provider_error";
}
export async function estimateMeal(
  description: string,
  apiKey: string,
  signal: AbortSignal,
  context: Pick<MealEvent, "operationId" | "mode">,
) {
  const started = performance.now();
  const deadline = AbortSignal.timeout(ESTIMATE_DEADLINE_MS);
  const client = new OpenAI({
    apiKey,
    timeout: ESTIMATE_DEADLINE_MS,
    maxRetries: 0,
  });
  let outcome: MealEvent["outcome"] = "provider_error";
  let usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    cachedTokens: number | null;
  } = {
    inputTokens: null,
    outputTokens: null,
    cachedTokens: null,
  };
  try {
    const response = await client.chat.completions.create(
      {
        model: ESTIMATE_VERSION.model,
        temperature: 0.2,
        max_tokens: ESTIMATE_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: ESTIMATE_PROMPT },
          { role: "user", content: description },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "nutrition",
            strict: true,
            schema: nutritionSchema,
          },
        },
      },
      { signal: AbortSignal.any([signal, deadline]) },
    );
    usage = {
      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
      cachedTokens:
        response.usage?.prompt_tokens_details?.cached_tokens ?? null,
    };
    const choice = response.choices[0];
    if (choice?.message.refusal || choice?.finish_reason === "content_filter")
      throw new EstimatorError("refused");
    if (choice?.finish_reason === "length")
      throw new EstimatorError("truncated");
    if (choice?.finish_reason !== "stop" || !choice.message.content)
      throw new EstimatorError("invalid");
    let meal;
    try {
      const parsed: unknown = JSON.parse(choice.message.content);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        Object.keys(parsed).length !== nutritionSchema.required.length ||
        nutritionSchema.required.some((key) => !(key in parsed))
      )
        throw new Error();
      meal = parseEstimate(parsed);
    } catch {
      throw new EstimatorError("invalid");
    }
    outcome = "success";
    return { ...meal, estimate: ESTIMATE_VERSION };
  } catch (error) {
    outcome = providerFailure(error, signal, deadline);
    throw new EstimatorError(outcome);
  } finally {
    emitMealEvent(
      {
        ...context,
        stage: "estimate",
        outcome,
        durationMs: performance.now() - started,
        attempt: 1,
      },
      { ...ESTIMATE_VERSION, ...usage },
    );
  }
}
