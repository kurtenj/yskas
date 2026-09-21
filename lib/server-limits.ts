import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { signToken } from "./session";

async function client() {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(await signToken("service", "convex", 60));
  return client;
}

export async function acquireLimit(kind: "pin" | "provider") {
  const leaseId = crypto.randomUUID();
  try {
    const convex = await client();
    const result = await convex.mutation(api.limits.acquire, { kind, leaseId });
    if (!result.allowed) return { response: Response.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(result.retryAfter) } }) };
    return { leaseId };
  } catch {
    return { response: Response.json({ error: "Request limits unavailable. Please try again later." }, { status: 503 }) };
  }
}

export async function releaseLimit(leaseId: string) {
  try {
    await (await client()).mutation(api.limits.release, { leaseId });
  } catch {
    // A crashed worker or failed release recovers when its bounded lease expires.
    console.error("Provider lease release failed");
  }
}
