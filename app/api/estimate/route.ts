import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a precise nutrition estimator. When given a meal description, respond ONLY with a JSON object (no markdown, no explanation) with these fields:
{
  "name": "short friendly meal name",
  "calories": <integer>,
  "protein": <integer grams>,
  "carbs": <integer grams>,
  "fat": <integer grams>
}

Rules:
- Estimate realistic calorie counts for typical US portion sizes
- If the description is unclear, make your best reasonable estimate
- name should be concise (3-6 words max)
- All numeric values must be integers
- Respond with ONLY the JSON object, nothing else`;

export async function POST(req: NextRequest) {
  const { description } = await req.json();

  if (!description || typeof description !== "string") {
    return NextResponse.json({ error: "Missing description" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  // Initialize inside the handler so env vars are guaranteed to be resolved
  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ],
      temperature: 0.2,
      max_tokens: 150,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error("Empty response from OpenAI");

    const parsed = JSON.parse(raw);

    if (
      typeof parsed.name !== "string" ||
      typeof parsed.calories !== "number"
    ) {
      throw new Error(`Invalid response shape: ${raw}`);
    }

    return NextResponse.json({
      name: parsed.name,
      calories: Math.round(parsed.calories),
      protein: typeof parsed.protein === "number" ? Math.round(parsed.protein) : undefined,
      carbs: typeof parsed.carbs === "number" ? Math.round(parsed.carbs) : undefined,
      fat: typeof parsed.fat === "number" ? Math.round(parsed.fat) : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Estimate error:", message);
    return NextResponse.json(
      {
        error: "Failed to estimate calories. Please try again.",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 }
    );
  }
}
