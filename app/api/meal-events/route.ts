import { NextRequest } from "next/server";
import { requireSession } from "@/lib/session";
import { readJsonObject, requestErrorResponse } from "@/lib/request-validation";
import { parseMealEvent } from "@/lib/telemetry";
export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;
  try {
    const body = await readJsonObject(request, 4096);
    if (
      !Array.isArray(body.events) ||
      !body.events.length ||
      body.events.length > 8
    )
      throw new Error("Invalid batch");
    const events = body.events.map(parseMealEvent);
    for (const event of events)
      console.info(
        JSON.stringify({
          event: "meal_entry",
          version: 1,
          at: new Date().toISOString(),
          source: "client",
          ...event,
        }),
      );
    return new Response(null, { status: 204 });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
