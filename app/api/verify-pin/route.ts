import { NextRequest, NextResponse } from "next/server";
import { readJsonObject, requestErrorResponse } from "@/lib/request-validation";
import { SESSION_COOKIE, SESSION_SECONDS, sameOrigin, signToken } from "@/lib/session";
import { acquireLimit } from "@/lib/server-limits";
import { createHash, timingSafeEqual } from "node:crypto";

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Authentication unavailable" }, { status: 503 });
  }
  let pin: unknown;
  try {
    ({ pin } = await readJsonObject(req, 1024));
    if (typeof pin !== "string" || pin.length > 128) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });
    }
  } catch (error) {
    return requestErrorResponse(error);
  }
  const expected = process.env.SITE_PIN;

  if (!expected) {
    return NextResponse.json(
      { error: "SITE_PIN not configured" },
      { status: 500 }
    );
  }

  const limit = await acquireLimit("pin");
  if (limit.response) return limit.response;
  if (!timingSafeEqual(createHash("sha256").update(pin as string).digest(), createHash("sha256").update(expected).digest())) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  let token: string;
  try {
    token = await signToken("household", "yskas-session", SESSION_SECONDS);
  } catch {
    return NextResponse.json({ error: "Authentication unavailable" }, { status: 503 });
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.delete("pin_verified");
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_SECONDS,
    path: "/",
  });
  return response;
}
