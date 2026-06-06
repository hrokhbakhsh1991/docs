import type { Prisma } from "@prisma/client";

/**
 * DEC-077 / CLK-TT-01 — one Postgres `now()` snapshot per canonical transaction.
 * Call once at the start of a `withCanonicalTransaction` callback and pass the
 * result to tour, audit, and outbox writes.
 */
export async function readCanonicalTransactionNow(tx: Prisma.TransactionClient): Promise<Date> {
  const rows = await tx.$queryRaw<Array<{ ts: Date }>>`SELECT now() AS ts`;
  const ts = rows[0]?.ts;
  if (!(ts instanceof Date) || Number.isNaN(ts.getTime())) {
    throw new Error("CANONICAL_TX_NOW_INVALID");
  }
  return ts;
}
