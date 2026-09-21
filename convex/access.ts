import type { QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";

// This deployment contains exactly one household. All of its profiles are shared.
// Never infer access from a profile ID supplied by a client.
export async function requireIdentity(ctx: Pick<QueryCtx, "auth">, subject: "household" | "service" = "household") {
  const identity = await ctx.auth.getUserIdentity();
  const issuer = process.env.AUTH_ISSUER;
  const version = process.env.AUTH_SESSION_VERSION;
  if (!issuer || !version || !identity || identity.issuer !== issuer ||
      identity.tokenIdentifier !== `${issuer}|${subject}` ||
      identity.sessionVersion !== version) {
    throw new ConvexError("Unauthorized");
  }
  return identity;
}
