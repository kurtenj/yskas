import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  readDescription,
  requestErrorResponse,
} from "@/lib/request-validation";
import { requireSession } from "@/lib/session";
import { acquireLimit, releaseLimit } from "@/lib/server-limits";
import { ESTIMATE_VERSION, parseEstimate } from "@/lib/nutrition";

const SYSTEM_PROMPT = `You are a precise nutrition estimator. When given a meal description, respond ONLY with a JSON object (no markdown, no explanation) with these fields:
{
  "name": "short friendly meal name",
  "calories": <nonnegative kcal>,
  "protein": <nonnegative grams or null>,
  "fiber": <nonnegative grams or null>,
  "carbs": <nonnegative grams or null>,
  "fat": <nonnegative grams or null>
}

Rules:
- Estimate realistic calorie counts for typical US portion sizes
- If the description is unclear, make your best reasonable estimate
- name should be concise (3-6 words max)
- Preserve explicit portions and label values; decimals are allowed
- Use null for an unknown nutrient, never substitute zero for missing information
- Respond with ONLY the JSON object, nothing else`;

export async function POST(req: NextRequest) {
  const denied = await requireSession(req);
  if (denied) return denied;
  let description: string;
  try {
    description = await readDescription(req);
  } catch (error) {
    return requestErrorResponse(error);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  // Initialize inside the handler so env vars are guaranteed to be resolved
  const openai = new OpenAI({ apiKey, timeout: 45_000, maxRetries: 0 });
  const limit = await acquireLimit("provider");
  if (limit.response) return limit.response;

  try {
    const completion = await openai.chat.completions.create(
      {
        model: ESTIMATE_VERSION.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: description },
        ],
        temperature: 0.2,
        max_tokens: 150,
      },
      { signal: AbortSignal.any([req.signal, AbortSignal.timeout(45_000)]) },
    );

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error("Empty response from OpenAI");

    const parsed = JSON.parse(raw);

    return NextResponse.json({
      ...parseEstimate(parsed),
      estimate: ESTIMATE_VERSION,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Estimate request failed");
    return NextResponse.json(
      {
        error: "Failed to estimate calories. Please try again.",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 },
    );
  } finally {
    await releaseLimit(limit.leaseId);
  }
}
