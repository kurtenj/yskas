import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  const expected = process.env.SITE_PIN;

  if (!expected) {
    return NextResponse.json(
      { error: "SITE_PIN not configured" },
      { status: 500 }
    );
  }

  if (pin !== expected) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("pin_verified", "true", {
    httpOnly: true,
    sameSite: "lax",
    // No explicit maxAge = session cookie (cleared when browser closes)
    // Set a long maxAge so it survives app restarts on mobile
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}
