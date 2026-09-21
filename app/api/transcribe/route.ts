import { NextRequest, NextResponse } from "next/server";
import { readAudio, requestErrorResponse } from "@/lib/request-validation";
import { requireSession } from "@/lib/session";
import { acquireLimit, releaseLimit } from "@/lib/server-limits";

import { emitMealEvent, requestContext, type MealEvent } from "@/lib/telemetry";

export async function POST(req: NextRequest) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const context = requestContext(req);
  let audio: Blob;
  try {
    audio = await readAudio(req);
  } catch (error) {
    emitMealEvent({
      ...context,
      stage: "transcribe",
      outcome: "rejected",
      durationMs: 0,
      attempt: 0,
    });
    return requestErrorResponse(error);
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 },
    );
  }

  const body = new FormData();
  const extension =
    (
      {
        "audio/mp4": "mp4",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
        "audio/mpeg": "mp3",
      } as Record<string, string>
    )[audio.type.split(";")[0]] ?? "webm";
  body.append("file", audio, `recording.${extension}`);
  body.append("model_id", "scribe_v1");
  const limit = await acquireLimit("provider");
  if (limit.response) {
    emitMealEvent({
      ...context,
      stage: "transcribe",
      outcome: "rejected",
      durationMs: 0,
      attempt: 0,
    });
    return limit.response;
  }
  const started = performance.now();
  const deadline = AbortSignal.timeout(45_000);
  let outcome: MealEvent["outcome"] = "provider_error";

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body,
      signal: AbortSignal.any([req.signal, deadline]),
    });

    if (!res.ok) {
      throw new Error("Transcription provider failed");
    }

    const data = await res.json();
    const transcript = typeof data.text === "string" ? data.text.trim() : "";

    if (!transcript) throw new Error("Empty transcript");

    outcome = "success";
    return NextResponse.json({ transcript });
  } catch {
    outcome = req.signal.aborted
      ? "cancelled"
      : deadline.aborted
        ? "timeout"
        : "provider_error";
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 },
    );
  } finally {
    emitMealEvent(
      {
        ...context,
        stage: "transcribe",
        outcome,
        durationMs: performance.now() - started,
        attempt: 1,
      },
      {
        model: "scribe_v1",
        promptVersion: "none",
        schemaVersion: 1,
        inputTokens: null,
        outputTokens: null,
        cachedTokens: null,
      },
    );
    await releaseLimit(limit.leaseId);
  }
}
