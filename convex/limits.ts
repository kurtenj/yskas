import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity } from "./access";

function limit(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`Invalid ${name}`);
  return value;
}

// Fixed bucket names keep storage bounded. Only the Next server can use these
// mutations; browser household JWTs cannot consume, release or reset quotas.
export const acquire = mutation({
  args: { kind: v.union(v.literal("pin"), v.literal("provider")), leaseId: v.string() },
  handler: async (ctx, { kind, leaseId }) => {
    await requireIdentity(ctx, "service");
    if (leaseId.length > 64) throw new Error("Invalid lease ID");
    const now = Date.now();
    const period = kind === "pin" ? 15 * 60_000 : 60_000;
    const perWindow = kind === "pin" ? limit("PIN_ATTEMPTS_PER_WINDOW", 10, 30) : limit("PROVIDER_REQUESTS_PER_MINUTE", 10, 100);
    const daily = limit("PROVIDER_REQUESTS_PER_DAY", 100, 1000);
    const concurrent = limit("PROVIDER_CONCURRENCY", 2, 10);
    const existing = await ctx.db.query("requestLimits").withIndex("by_kind", q => q.eq("kind", kind)).unique();
    const windowStart = existing && now < existing.windowStart + period ? existing.windowStart : now;
    const count = existing && windowStart === existing.windowStart ? existing.count : 0;
    const dayStart = Math.floor(now / 86_400_000) * 86_400_000;
    const dayCount = existing?.dayStart === dayStart ? existing.dayCount : 0;
    const leases = existing?.leases.filter(lease => lease.expiresAt > now) ?? [];
    let retryAt = 0;
    if (count >= perWindow) retryAt = windowStart + period;
    if (kind === "provider" && dayCount >= daily) retryAt = Math.max(retryAt, dayStart + 86_400_000);
    if (kind === "provider" && leases.length >= concurrent) retryAt = Math.max(retryAt, Math.min(...leases.map(lease => lease.expiresAt)));
    if (retryAt) return { allowed: false, retryAfter: Math.max(1, Math.ceil((retryAt - now) / 1000)) };
    const data = { kind, windowStart, count: count + 1, dayStart, dayCount: dayCount + 1,
      leases: kind === "provider" ? [...leases, { id: leaseId, expiresAt: now + 120_000 }] : [] };
    if (existing) await ctx.db.replace(existing._id, data);
    else await ctx.db.insert("requestLimits", data);
    return { allowed: true, retryAfter: 0 };
  },
});

export const release = mutation({
  args: { leaseId: v.string() },
  handler: async (ctx, { leaseId }) => {
    await requireIdentity(ctx, "service");
    const existing = await ctx.db.query("requestLimits").withIndex("by_kind", q => q.eq("kind", "provider")).unique();
    if (existing) await ctx.db.patch(existing._id, { leases: existing.leases.filter(lease => lease.id !== leaseId && lease.expiresAt > Date.now()) });
  },
});
