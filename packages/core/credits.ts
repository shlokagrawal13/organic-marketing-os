import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { stableJson } from "./requests";
import { AITask } from "./ai";

type Tx = Prisma.TransactionClient;
export class CreditError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function creditPolicy() {
  const mode = process.env.BILLING_MODE || "self_hosted";
  if (!["self_hosted", "credits"].includes(mode))
    throw new Error("BILLING_MODE must be self_hosted or credits.");
  const prices = Object.fromEntries(
    (["strategy", "content", "scene"] as const).map((task, index) => {
      const amount = Number(
        process.env[`AI_${task.toUpperCase()}_CREDITS`] || [5, 3, 1][index],
      );
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10000)
        throw new Error(
          "AI credit prices must be whole numbers between 1 and 10000.",
        );
      return [task, amount];
    }),
  ) as Record<AITask, number>;
  return { mode, prices };
}

// Every caller uses the same organization lock, including job creation/cancellation.
// Ledger entries and their cached balances commit in one database transaction.
async function account(tx: Tx, organizationId: string) {
  const rows = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
  if (!rows.length) throw new CreditError(404, "Workspace not found.");
  return tx.creditAccount.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}
type Entry = {
  organizationId: string;
  operationKey: string;
  kind: "GRANT" | "ADJUSTMENT" | "RESERVE" | "CONSUME" | "RELEASE";
  availableDelta: number;
  reservedDelta: number;
  reference: string;
  reason: string;
  actorId?: string;
};
async function append(tx: Tx, input: Entry) {
  const a = await account(tx, input.organizationId);
  const requestHash = createHash("sha256")
    .update(stableJson(input))
    .digest("hex");
  const existing = await tx.creditEntry.findUnique({
    where: {
      organizationId_operationKey: {
        organizationId: input.organizationId,
        operationKey: input.operationKey,
      },
    },
  });
  if (existing) {
    if (existing.requestHash !== requestHash)
      throw new CreditError(
        409,
        "This credit operation key belongs to a different request.",
      );
    return existing;
  }
  const availableAfter = a.available + input.availableDelta,
    reservedAfter = a.reserved + input.reservedDelta;
  if (
    ![availableAfter, reservedAfter].every(
      (value) =>
        Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000,
    )
  )
    throw new CreditError(
      409,
      "Insufficient credits or credit account limit exceeded.",
    );
  const entry = await tx.creditEntry.create({
    data: {
      ...input,
      requestHash,
      availableAfter,
      reservedAfter,
      sequence: a.revision + 1,
    },
  });
  await tx.creditAccount.update({
    where: { organizationId: input.organizationId },
    data: {
      available: availableAfter,
      reserved: reservedAfter,
      revision: { increment: 1 },
    },
  });
  return entry;
}
export async function grantCredits(
  tx: Tx,
  organizationId: string,
  amount: number,
  operationKey: string,
  reason: string,
  actorId: string,
) {
  if (
    !Number.isSafeInteger(amount) ||
    amount === 0 ||
    Math.abs(amount) > 1_000_000
  )
    throw new CreditError(
      400,
      "Credit adjustment must be a nonzero whole number up to 1000000.",
    );
  if (reason.trim().length < 10 || reason.length > 1000)
    throw new CreditError(400, "Record a reason for the credit adjustment.");
  return append(tx, {
    organizationId,
    operationKey: `admin:${operationKey}`,
    kind: amount > 0 ? "GRANT" : "ADJUSTMENT",
    availableDelta: amount,
    reservedDelta: 0,
    reference: `admin:${operationKey}`,
    reason,
    actorId,
  });
}
export async function reserveCredits(
  tx: Tx,
  organizationId: string,
  reference: string,
  credits: number,
  actorId: string,
) {
  if (!Number.isSafeInteger(credits) || credits < 1 || credits > 10000)
    throw new CreditError(400, "Invalid credit quote.");
  await account(tx, organizationId);
  const existing = await tx.creditReservation.findUnique({
    where: { organizationId_reference: { organizationId, reference } },
  });
  if (existing) {
    if (existing.credits !== credits)
      throw new CreditError(
        409,
        "This reservation has a different credit quote.",
      );
    return existing;
  }
  const reservation = await tx.creditReservation.create({
    data: { organizationId, reference, credits },
  });
  await append(tx, {
    organizationId,
    operationKey: `reserve:${reservation.id}`,
    kind: "RESERVE",
    availableDelta: -credits,
    reservedDelta: credits,
    reference,
    reason: "Reserved before starting AI generation",
    actorId,
  });
  return reservation;
}
export async function settleCredits(
  tx: Tx,
  organizationId: string,
  id: string,
  consumed: number,
  reason: string,
  actorId?: string,
) {
  await account(tx, organizationId);
  const r = await tx.creditReservation.findFirst({
    where: { id, organizationId },
  });
  if (!r) throw new CreditError(404, "Credit reservation not found.");
  if (!Number.isSafeInteger(consumed) || consumed < 0 || consumed > r.credits)
    throw new CreditError(
      400,
      "Consumption must be within the reserved quote.",
    );
  if (["SETTLED", "RELEASED"].includes(r.state)) {
    if (r.consumed !== consumed)
      throw new CreditError(
        409,
        "Reservation already resolved with a different amount.",
      );
    return r;
  }
  if (reason.trim().length < 10 || reason.length > 1000)
    throw new CreditError(400, "Record why these credits were resolved.");
  await append(tx, {
    organizationId,
    operationKey: `settle:${id}`,
    kind: consumed ? "CONSUME" : "RELEASE",
    availableDelta: r.credits - consumed,
    reservedDelta: -r.credits,
    reference: r.reference,
    reason,
    actorId,
  });
  return tx.creditReservation.update({
    where: { id },
    data: {
      consumed,
      state: consumed ? "SETTLED" : "RELEASED",
      resolvedAt: new Date(),
    },
  });
}
export async function reviewCredits(
  tx: Tx,
  organizationId: string,
  id: string,
) {
  await account(tx, organizationId);
  // Unknown provider outcomes retain their reservation; they are never shown as free.
  await tx.creditReservation.updateMany({
    where: { id, organizationId, state: "RESERVED" },
    data: { state: "REVIEW" },
  });
}
