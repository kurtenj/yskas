import { NextRequest, NextResponse } from "next/server";
import {
  readDescription,
  requestErrorResponse,
} from "@/lib/request-validation";
import { requireSession } from "@/lib/session";
import { acquireLimit, releaseLimit } from "@/lib/server-limits";
import { estimateMeal, EstimatorError } from "@/lib/estimator";
import { emitMealEvent, requestContext } from "@/lib/telemetry";

export async function POST(req: NextRequest) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const context = requestContext(req);
  let description: string;
  try {
    description = await readDescription(req);
  } catch (error) {
    emitMealEvent({
      ...context,
      stage: "estimate",
      outcome: "rejected",
      durationMs: 0,
      attempt: 0,
    });
    return requestErrorResponse(error);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "Estimation unavailable" },
      { status: 503 },
    );
  const limit = await acquireLimit("provider");
  if (limit.response) {
    emitMealEvent({
      ...context,
      stage: "estimate",
      outcome: "rejected",
      durationMs: 0,
      attempt: 0,
    });
    return limit.response;
  }
  try {
    return NextResponse.json(
      await estimateMeal(description, apiKey, req.signal, context),
    );
  } catch (error) {
    const category =
      error instanceof EstimatorError ? error.category : "provider_error";
    return NextResponse.json(
      { error: "Failed to estimate calories. Please try again.", category },
      {
        status:
          category === "timeout" ? 504 : category === "cancelled" ? 499 : 502,
      },
    );
  } finally {
    await releaseLimit(limit.leaseId);
  }
}
