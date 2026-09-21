// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
const create = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));
import {
  estimateMeal,
  ESTIMATE_OUTPUT_TOKENS,
  providerFailure,
} from "../lib/estimator";
import { parseMealEvent, reportMealEvent } from "../lib/telemetry";
const context = {
  operationId: "1f1c1c10-1111-4111-8111-111111111111",
  mode: "text" as const,
};
const valid = {
  name: "Beans",
  calories: 200.5,
  protein: 12.1,
  fiber: 8.7,
  carbs: null,
  fat: null,
};
afterEach(() => vi.restoreAllMocks());
test.each([
  [
    "refused",
    { message: { refusal: "sensitive content" }, finish_reason: "stop" },
  ],
  [
    "truncated",
    { message: { content: JSON.stringify(valid) }, finish_reason: "length" },
  ],
  ["invalid", { message: { content: "{" }, finish_reason: "stop" }],
  [
    "invalid",
    {
      message: { content: JSON.stringify({ ...valid, fiber: -1 }) },
      finish_reason: "stop",
    },
  ],
  [
    "invalid",
    {
      message: { content: JSON.stringify({ name: "Beans", calories: 100 }) },
      finish_reason: "stop",
    },
  ],
])("rejects %s without leaking response contents", async (category, choice) => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  create.mockResolvedValue({
    choices: [choice],
    usage: { prompt_tokens: 100, completion_tokens: 40 },
  });
  await expect(
    estimateMeal("private meal", "test", new AbortController().signal, context),
  ).rejects.toMatchObject({ category });
  const event = JSON.parse(log.mock.calls[0][0]);
  expect(event).toMatchObject({
    outcome: category,
    provider: { inputTokens: 100, outputTokens: 40 },
  });
  expect(JSON.stringify(event)).not.toMatch(
    /private meal|sensitive content|Beans/,
  );
});
test("strict request uses bounded output and provider usage; missing usage remains null", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  create.mockResolvedValue({
    choices: [
      { finish_reason: "stop", message: { content: JSON.stringify(valid) } },
    ],
  });
  const result = await estimateMeal(
    "beans",
    "test",
    new AbortController().signal,
    context,
  );
  expect(result).toMatchObject({ calories: 200.5, fiber: 8.7 });
  expect(create.mock.lastCall?.[0]).toMatchObject({
    max_tokens: ESTIMATE_OUTPUT_TOKENS,
    response_format: { json_schema: { strict: true } },
  });
  expect(JSON.parse(log.mock.calls[0][0]).provider.inputTokens).toBeNull();
});
test("timeout and caller cancellation remain distinguishable", () => {
  const caller = new AbortController(),
    deadline = new AbortController();
  deadline.abort();
  expect(providerFailure(new Error(), caller.signal, deadline.signal)).toBe(
    "timeout",
  );
  caller.abort();
  expect(providerFailure(new Error(), caller.signal, deadline.signal)).toBe(
    "cancelled",
  );
});
test("client telemetry allowlist strips sensitive extras and rejects unbounded fields", () => {
  const event = {
    ...context,
    stage: "save",
    outcome: "success",
    durationMs: 5,
    attempt: 1,
  };
  expect(
    parseMealEvent({ ...event, description: "private", audio: "private" }),
  ).toEqual(event);
  expect(() =>
    parseMealEvent({ ...event, operationId: "private text" }),
  ).toThrow();
  expect(() => parseMealEvent({ ...event, durationMs: Infinity })).toThrow();
});

test("telemetry validation and delivery failures never interrupt meal entry", () => {
  expect(() =>
    reportMealEvent({
      ...context,
      stage: "save",
      outcome: "success",
      durationMs: Infinity,
      attempt: 1,
    }),
  ).not.toThrow();
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new Error("keepalive unavailable");
  });
  expect(() =>
    reportMealEvent({
      ...context,
      stage: "save",
      outcome: "success",
      durationMs: 10,
      attempt: 1,
    }),
  ).not.toThrow();
  expect(fetch).toHaveBeenCalledOnce();
});
