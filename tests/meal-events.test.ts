// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() =>
  vi.fn(async (): Promise<Response | null> => null),
);
vi.mock("../lib/session", () => ({ requireSession: auth }));
import { POST } from "../app/api/meal-events/route";
afterEach(() => vi.restoreAllMocks());
function request(body: unknown) {
  return new NextRequest("https://example.test/api/meal-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: [body] }),
  });
}
const event = {
  operationId: "1f1c1c10-1111-4111-8111-111111111111",
  mode: "text",
  stage: "save",
  outcome: "success",
  durationMs: 10,
  attempt: 1,
};
test("telemetry requires a session", async () => {
  auth.mockResolvedValueOnce(new Response(null, { status: 401 }));
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  expect((await POST(request(event))).status).toBe(401);
  expect(log).not.toHaveBeenCalled();
});
test("telemetry logs only allowed fields and caps the body", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  expect(
    (
      await POST(
        request({ ...event, description: "private meal", source: "server" }),
      )
    ).status,
  ).toBe(204);
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
    source: "client",
    ...event,
  });
  expect(log.mock.calls[0][0]).not.toContain("private meal");
  expect(
    (await POST(request({ ...event, description: "x".repeat(5000) }))).status,
  ).toBe(413);
  expect(
    (await POST(request({ ...event, outcome: "private description" }))).status,
  ).toBe(400);
  expect(log).toHaveBeenCalledOnce();
});
