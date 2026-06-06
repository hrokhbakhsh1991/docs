import type { Prisma } from "@prisma/client";

/**
 * Detect Prisma / driver errors when the connection pool cannot grant a connection in time.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-012
 */
export function isPoolSaturationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Unable to start a transaction|Timed out fetching|connection pool/i.test(message);
}

/** Rethrow with stable prefix consumed by HTTP `mapErrorToStatus` → 503. */
export function asDbPoolSaturatedError(error: unknown): Error {
  const base = error instanceof Error ? error.message : String(error);
  return new Error(`DB_POOL_SATURATED: ${base}`, {
    cause: error instanceof Error ? error : undefined,
  });
}

export async function withPoolSaturationMapping<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isPoolSaturationError(error)) {
      throw asDbPoolSaturatedError(error);
    }
    throw error;
  }
}

const MAX_TEST_HOLD_MS = 30_000;

/** Test-only TX hold — gated by NODE_ENV=test and P5_DB_HOLD_MS (DEC-012). */
export function readTestDbHoldMs(): number {
  if (process.env.NODE_ENV !== "test") {
    return 0;
  }
  const raw = process.env.P5_DB_HOLD_MS?.trim();
  if (!raw) {
    return 0;
  }
  const ms = Number.parseInt(raw, 10);
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_TEST_HOLD_MS) {
    return 0;
  }
  return ms;
}

export async function applyTestDbHoldIfConfigured(tx: Prisma.TransactionClient): Promise<void> {
  const holdMs = readTestDbHoldMs();
  if (holdMs <= 0) {
    return;
  }
  const seconds = holdMs / 1000;
  await tx.$executeRawUnsafe(`SELECT pg_sleep(${seconds})`);
}
