import { createLocalJWKSet, importJWK, jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "yskas_session";
export const SESSION_SECONDS = 14 * 24 * 60 * 60;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function signToken(subject: "household" | "service", audience: string, seconds: number) {
  const jwk = JSON.parse(required("AUTH_PRIVATE_JWK"));
  const key = await importJWK(jwk, "RS256");
  return new SignJWT({ sessionVersion: required("AUTH_SESSION_VERSION") })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: jwk.kid })
    .setIssuer(required("AUTH_ISSUER"))
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + seconds)
    .sign(key);
}

export async function verifySession(token: string | undefined) {
  if (!token) return false;
  // Configuration failures must not be mistaken for valid sessions.
  const issuer = required("AUTH_ISSUER");
  const version = required("AUTH_SESSION_VERSION");
  const keys = createLocalJWKSet(JSON.parse(required("AUTH_JWKS")));
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ["RS256"], issuer, audience: "yskas-session",
      requiredClaims: ["exp", "iat", "sub"], maxTokenAge: SESSION_SECONDS,
    });
    return payload.sub === "household" && payload.sessionVersion === version;
  } catch {
    return false;
  }
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return request.headers.get("sec-fetch-site") !== "cross-site" &&
    (!origin || origin === required("AUTH_ISSUER"));
}

export async function requireSession(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) return null;
    return Response.json({ error: "Please sign in again" }, { status: 401 });
  } catch {
    return Response.json({ error: "Authentication unavailable" }, { status: 503 });
  }
}
