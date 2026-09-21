export class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function configuredLimit(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new RequestError("Invalid request-limit configuration", 503);
  return value;
}

// Count streamed bytes: Content-Length alone is optional and client-controlled.
export async function readBoundedBody(request: Request, maxBytes: number) {
  const length = request.headers.get("content-length");
  if (length && Number(length) > maxBytes) {
    throw new RequestError("Request is too large", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Missing request body", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestError("Request is too large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJsonObject(request: Request, maxBytes: number) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError("Expected application/json", 415);
  }
  const bytes = await readBoundedBody(request, maxBytes);
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new RequestError("Invalid JSON body", 400);
  }
}

export async function readDescription(request: Request) {
  const { description } = await readJsonObject(request, configuredLimit("MAX_DESCRIPTION_BODY_BYTES", 16_384, 65_536));
  if (typeof description !== "string" || !description.trim()) {
    throw new RequestError("Missing description", 400);
  }
  if (description.trim().length > configuredLimit("MAX_DESCRIPTION_CHARS", 2_000, 8_000)) throw new RequestError("Description is too long", 413);
  return description.trim();
}

export async function readAudio(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    throw new RequestError("Expected multipart/form-data", 415);
  }
  const maxAudioBytes = configuredLimit("MAX_AUDIO_BYTES", 4 * 1024 * 1024, 16 * 1024 * 1024);
  const bytes = await readBoundedBody(request, maxAudioBytes + 16_384);
  let form: FormData;
  try {
    form = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new RequestError("Invalid multipart body", 400);
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) throw new RequestError("Missing audio", 400);
  if (audio.size > maxAudioBytes) throw new RequestError("Audio is too large", 413);
  const mime = audio.type.split(";")[0].trim().toLowerCase();
  if (!["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"].includes(mime)) {
    throw new RequestError("Unsupported audio type", 415);
  }
  return audio;
}

export function requestErrorResponse(error: unknown) {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: "Unable to read request" }, { status: 400 });
}
