import type { NextRequest } from "next/server";
import { requireSession, signToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  try {
    return Response.json({ token: await signToken("household", "convex", 300) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Authentication unavailable" }, { status: 503 });
  }
}
