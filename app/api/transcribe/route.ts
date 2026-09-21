import { NextRequest, NextResponse } from "next/server";
import { readAudio, requestErrorResponse } from "@/lib/request-validation";
import { requireSession } from "@/lib/session";
import { acquireLimit, releaseLimit } from "@/lib/server-limits";

export async function POST(req: NextRequest) {
  const denied = await requireSession(req);
  if (denied) return denied;
  let audio: Blob;
  try {
    audio = await readAudio(req);
  } catch (error) {
    return requestErrorResponse(error);
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
  }

  const body = new FormData();
  const extension = ({ "audio/mp4": "mp4", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mpeg": "mp3" } as Record<string, string>)[audio.type.split(";")[0]] ?? "webm";
  body.append("file", audio, `recording.${extension}`);
  body.append("model_id", "scribe_v1");
  const limit = await acquireLimit("provider");
  if (limit.response) return limit.response;

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body,
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(45_000)]),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ElevenLabs error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const transcript = data.text?.trim();

    if (!transcript) throw new Error("Empty transcript");

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("Transcribe request failed", err instanceof Error ? err.name : "UnknownError");
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 });
  } finally {
    await releaseLimit(limit.leaseId);
  }
}
