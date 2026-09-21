import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { canonical, validateOperationId } from "../lib/operation";
import { offsetDate, todayDate } from "../lib/dates";

export async function prepareOperation(
  ctx: MutationCtx,
  kind: "add" | "reuse",
  args: {
    operationId?: string;
    userId: Id<"users">;
    date: string;
  },
) {
  if (!args.operationId) return null; // Old clients remain compatible.
  validateOperationId(args.operationId);
  if (args.date < offsetDate(todayDate(), -13) || args.date > todayDate())
    throw new Error("Logging date is outside the retention window.");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical({ kind, ...args })),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const previous = await ctx.db
    .query("mealOperations")
    .withIndex("by_operationId", (q) => q.eq("operationId", args.operationId!))
    .unique();
  if (
    previous &&
    (previous.userId !== args.userId || previous.fingerprint !== fingerprint)
  )
    throw new Error("Operation ID already belongs to a different submission.");
  return { operationId: args.operationId, fingerprint, previous };
}

export async function finishOperation(
  ctx: MutationCtx,
  operation: Awaited<ReturnType<typeof prepareOperation>>,
  userId: Id<"users">,
  date: string,
  mealId: Id<"meals">,
) {
  if (operation)
    await ctx.db.insert("mealOperations", {
      operationId: operation.operationId,
      fingerprint: operation.fingerprint,
      userId,
      date,
      mealId,
    });
  return mealId;
}
