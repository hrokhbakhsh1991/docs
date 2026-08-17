/**
 * Prisma error constructors are not always objects (memory driver / empty DATABASE_URL).
 * Bare `error instanceof Prisma.PrismaClient*Error` then throws TypeError and exits Node.
 */
export function isPrismaErrorOfType(error: unknown, ctor: unknown): error is object {
  return typeof ctor === "function" && error instanceof (ctor as new (...args: never[]) => object);
}

/** Duck-read Prisma request error `.code` without narrowing to PrismaClientKnownRequestError. */
export function readPrismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

const CONCURRENCY_CODES = new Set(["P2002", "P2034"]);

function errorMessageHaystack(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  return String(error ?? "").toLowerCase();
}

/**
 * Duplicate unique index — outbox `(tenant_id, domain_event_id)` and HTTP idempotency
 * `(tenant_id, idempotency_key)`. Driver adapters may not pass `instanceof KnownRequestError`.
 */
export function isPrismaUniqueConstraintError(error: unknown): boolean {
  if (readPrismaErrorCode(error) === "P2002") {
    return true;
  }
  return errorMessageHaystack(error).includes("unique constraint failed");
}

/**
 * Concurrent interactive TX loser: unique violation **or** write conflict / deadlock (`P2034`).
 * Finance approve maps this to `FINANCE_APPROVE_CONFLICT` (HTTP 409), not opaque 500.
 */
export function isPrismaConcurrencyConflict(error: unknown): boolean {
  const code = readPrismaErrorCode(error);
  if (code !== undefined && CONCURRENCY_CODES.has(code)) {
    return true;
  }
  const haystack = errorMessageHaystack(error);
  return (
    haystack.includes("unique constraint failed") ||
    haystack.includes("write conflict") ||
    haystack.includes("could not serialize")
  );
}
