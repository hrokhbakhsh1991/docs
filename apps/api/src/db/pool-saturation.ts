import type { Prisma } from "@prisma/client";

export const DB_POOL_SATURATED = "DB_POOL_SATURATED";

const DEFAULT_POOL_SATURATION_RETRY_AFTER_SEC = 2;

/**
 * Detect Prisma / driver errors when the connection pool cannot grant a connection in time.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-012
 */
export function isPoolSaturationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Unable to start a transaction|Timed out fetching|connection pool/i.test(message);
}

export function resolvePoolSaturationRetryAfterSec(): number {
  const raw = process.env.DB_POOL_SATURATED_RETRY_AFTER_SEC?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_POOL_SATURATION_RETRY_AFTER_SEC;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_POOL_SATURATION_RETRY_AFTER_SEC;
  }
  return Math.min(parsed, 120);
}

/** Typed 503 pool saturation — carries client `Retry-After` hint (DEC-113). */
export class DbPoolSaturatedError extends Error {
  readonly code = DB_POOL_SATURATED;

  constructor(
    message: string,
    readonly retryAfterSec = resolvePoolSaturationRetryAfterSec(),
    options?: { cause?: unknown }
  ) {
    super(`${DB_POOL_SATURATED}: ${message}`);
    this.name = "DbPoolSaturatedError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isDbPoolSaturatedError(error: unknown): error is DbPoolSaturatedError {
  if (error instanceof DbPoolSaturatedError) {
    return true;
  }
  return error instanceof Error && error.message.startsWith(`${DB_POOL_SATURATED}:`);
}

export function readDbPoolSaturatedRetryAfterSec(error: unknown): number {
  if (error instanceof DbPoolSaturatedError) {
    return error.retryAfterSec;
  }
  return resolvePoolSaturationRetryAfterSec();
}

/** Rethrow with stable typed error consumed by HTTP interceptor → 503 + Retry-After. */
export function asDbPoolSaturatedError(error: unknown): DbPoolSaturatedError {
  const base = error instanceof Error ? error.message : String(error);
  return new DbPoolSaturatedError(base, resolvePoolSaturationRetryAfterSec(), {
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
