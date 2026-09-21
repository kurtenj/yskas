// @vitest-environment node
import { beforeAll, beforeEach, afterEach, expect, test, vi } from "vitest";
import { exportJWK, generateKeyPair, jwtVerify, createLocalJWKSet } from "jose";
import { NextRequest } from "next/server";
import {
  requireSession,
  SESSION_COOKIE,
  signToken,
  verifySession,
} from "../lib/session";
import { POST as exchange } from "../app/api/auth/token/route";
import { POST as estimate } from "../app/api/estimate/route";
import { POST as transcribe } from "../app/api/transcribe/route";
import { POST as login } from "../app/api/verify-pin/route";

vi.mock("server-only", () => ({}));

const limits = vi.hoisted(() => ({ acquire: vi.fn(), release: vi.fn() }));
vi.mock("../lib/server-limits", () => ({
  acquireLimit: limits.acquire,
  releaseLimit: limits.release,
}));
let privateJwk: string;
let jwks: string;
beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateJwk = JSON.stringify({
    ...(await exportJWK(pair.privateKey)),
    kid: "test",
  });
  jwks = JSON.stringify({
    keys: [
      {
        ...(await exportJWK(pair.publicKey)),
        kid: "test",
        alg: "RS256",
        use: "sig",
      },
    ],
  });
});
beforeEach(() => {
  vi.stubEnv("AUTH_PRIVATE_JWK", privateJwk);
  vi.stubEnv("AUTH_JWKS", jwks);
  vi.stubEnv("AUTH_ISSUER", "https://yskas.test");
  vi.stubEnv("AUTH_SESSION_VERSION", "1");
  vi.stubEnv("SITE_PIN", "1234");
  limits.acquire.mockResolvedValue({ leaseId: "test" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function request(token?: string, origin?: string) {
  return new NextRequest("https://yskas.test/api/auth/token", {
    method: "POST",
    headers: {
      ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
      ...(origin ? { origin } : {}),
    },
  });
}
test("valid signed sessions exchange for short-lived Convex-only tokens", async () => {
  const session = await signToken("household", "yskas-session", 60);
  expect(await verifySession(session)).toBe(true);
  expect(await requireSession(request(session))).toBeNull();
  const response = await exchange(request(session));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const { token } = await response.json();
  const { payload } = await jwtVerify(
    token,
    createLocalJWKSet(JSON.parse(jwks)),
    { audience: "convex" },
  );
  expect(payload.sub).toBe("household");
  expect(payload.exp! - payload.iat!).toBe(300);
  expect(await verifySession(token)).toBe(false);
});
test("forged, expired, wrong-role, wrong-audience and revoked sessions fail", async () => {
  const valid = await signToken("household", "yskas-session", 60);
  for (const value of [
    undefined,
    "true",
    valid + "x",
    await signToken("household", "yskas-session", -1),
    await signToken("service", "yskas-session", 60),
    await signToken("household", "convex", 60),
  ]) {
    expect(await verifySession(value)).toBe(false);
  }
  vi.stubEnv("AUTH_SESSION_VERSION", "2");
  expect(await verifySession(valid)).toBe(false);
});
test("foreign origin is rejected even with a valid session", async () => {
  const session = await signToken("household", "yskas-session", 60);
  expect(
    (await requireSession(request(session, "https://evil.test")))?.status,
  ).toBe(403);
});
test("old literal cookie and absent sessions cannot reach paid providers or quotas", async () => {
  for (const handler of [estimate, transcribe, exchange]) {
    const response = await handler(
      new NextRequest("https://yskas.test/api/test", {
        method: "POST",
        headers: { cookie: "pin_verified=true" },
      }),
    );
    expect(response.status).toBe(401);
  }
  expect(limits.acquire).not.toHaveBeenCalled();
});
test("PIN login signs an HttpOnly cookie only after durable limit admission", async () => {
  const pinRequest = () =>
    new NextRequest("https://yskas.test/api/verify-pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"pin":"1234"}',
    });
  const response = await login(pinRequest());
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  const cookie = response.headers
    .get("set-cookie")
    ?.match(/yskas_session=([^;]+)/)?.[1];
  expect(await verifySession(cookie)).toBe(true);
  limits.acquire.mockResolvedValueOnce({
    response: Response.json({ error: "Limited" }, { status: 429 }),
  });
  const limited = await login(pinRequest());
  expect(limited.status).toBe(429);
  expect(limited.headers.get("set-cookie")).toBeNull();
});
