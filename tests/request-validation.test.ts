import { expect, test } from "vitest";
import { readAudio, readBoundedBody, readDescription, readJsonObject } from "../lib/request-validation";

const json = (body: string) => new Request("https://example.test", { method: "POST", headers: { "content-type": "application/json" }, body });

test.each(["{", "null", "[]", '"hello"'])("rejects invalid JSON object %s", async (body) => {
  await expect(readJsonObject(json(body), 1024)).rejects.toMatchObject({ status: 400 });
});
test.each(["", " \n ", "a".repeat(2001)])("rejects empty/oversize description", async (description) => {
  await expect(readDescription(json(JSON.stringify({ description })))).rejects.toHaveProperty("status", description.length > 2000 ? 413 : 400);
});
test("accepts the description boundary and trims whitespace", async () => {
  expect(await readDescription(json(JSON.stringify({ description: ` ${"a".repeat(2000)} ` })))).toHaveLength(2000);
});
test("enforces actual bytes without Content-Length", async () => {
  await expect(readBoundedBody(json("12345"), 4)).rejects.toMatchObject({ status: 413 });
  expect(await readBoundedBody(json("1234"), 4)).toHaveLength(4);
});
test("rejects incorrect media types and malformed multipart", async () => {
  await expect(readJsonObject(new Request("https://example.test", { method: "POST", body: "{}" }), 1024)).rejects.toMatchObject({ status: 415 });
  await expect(readAudio(json("{}"))).rejects.toMatchObject({ status: 415 });
  await expect(readAudio(new Request("https://example.test", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=missing" }, body: "bad" }))).rejects.toMatchObject({ status: 400 });
});
test.each(["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"])("accepts supported %s", async (type) => {
  const form = new FormData();
  form.append("audio", new Blob(["audio"], { type }), "recording");
  expect((await readAudio(new Request("https://example.test", { method: "POST", body: form }))).size).toBe(5);
});
test.each([[0, "audio/webm", 400], [1, "text/plain", 415], [4 * 1024 * 1024 + 1, "audio/webm", 413]] as const)("rejects invalid audio (%i bytes, %s)", async (size, type, status) => {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(size)], { type }), "recording");
  await expect(readAudio(new Request("https://example.test", { method: "POST", body: form }))).rejects.toMatchObject({ status });
});
