import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
  }

  const formData = await req.formData();
  const audio = formData.get("audio");

  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "Missing audio" }, { status: 400 });
  }

  const body = new FormData();
  body.append("file", audio, "recording.webm");
  body.append("model_id", "scribe_v1");

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body,
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("Transcribe error:", message);
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 });
  }
}
