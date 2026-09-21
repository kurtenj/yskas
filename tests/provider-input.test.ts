// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as estimate } from "../app/api/estimate/route";
import { POST as transcribe } from "../app/api/transcribe/route";

const mocks = vi.hoisted(() => ({ create: vi.fn(), requireSession: vi.fn(async () => null), acquire: vi.fn(async () => ({ leaseId: "test" })), release: vi.fn() }));
vi.mock("../lib/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("../lib/server-limits", () => ({ acquireLimit: mocks.acquire, releaseLimit: mocks.release }));
vi.mock("openai", () => ({ default: class {
  chat = { completions: { create: mocks.create } };
} }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

test.each(["{", '{"description":"   "}', JSON.stringify({ description: "a".repeat(2001) })])("invalid estimates never invoke the provider", async (body) => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  const response = await estimate(new NextRequest("https://example.test/api/estimate", { method: "POST", body, headers: { "content-type": "application/json" } }));
  expect([400, 413]).toContain(response.status);
  expect(mocks.create).not.toHaveBeenCalled();
});
test("valid estimate preserves the existing output contract", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  mocks.create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ name: "Eggs", calories: 140, protein: 12 }) } }] });
  const response = await estimate(new NextRequest("https://example.test/api/estimate", { method: "POST", body: JSON.stringify({ description: " two eggs " }), headers: { "content-type": "application/json" } }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ name: "Eggs", calories: 140, protein: 12 });
  expect(mocks.create).toHaveBeenCalledOnce();
});
test("unsupported audio never invokes transcription", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "test-only");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const form = new FormData();
  form.append("audio", new Blob(["hello"], { type: "text/plain" }), "audio.txt");
  const response = await transcribe(new NextRequest("https://example.test/api/transcribe", { method: "POST", body: form }));
  expect(response.status).toBe(415);
  expect(fetch).not.toHaveBeenCalled();
});

test("limited requests never invoke providers", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  mocks.acquire.mockResolvedValueOnce({ response: Response.json({ error: "Limited" }, { status: 429 }) } as never);
  const response = await estimate(new NextRequest("https://example.test/api/estimate", { method: "POST", body: '{"description":"eggs"}', headers: { "content-type": "application/json" } }));
  expect(response.status).toBe(429);
  expect(mocks.create).not.toHaveBeenCalled();
});

test("provider failure releases its concurrency lease", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  mocks.create.mockRejectedValueOnce(new Error("Test failure"));
  const response = await estimate(new NextRequest("https://example.test/api/estimate", { method: "POST", body: '{"description":"eggs"}', headers: { "content-type": "application/json" } }));
  expect(response.status).toBe(500);
  expect(mocks.release).toHaveBeenCalledWith("test");
});
