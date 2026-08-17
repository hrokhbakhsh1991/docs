import { Prisma } from "@prisma/client";

import { isPoolSaturationError } from "./pool-saturation";
import { isPrismaErrorOfType } from "./prisma-error-instance";

const TRANSIENT_PRISMA_CODES = new Set(["P1001", "P1002", "P1017"]);

function errorChainMessages(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== undefined; depth += 1) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
      continue;
    }
    messages.push(String(current));
    break;
  }
  return messages;
}

/** Classifies intermittent Postgres / driver failures (DEC-094 / SH-GAP-04). */
export function isTransientDbError(error: unknown): boolean {
  if (isPoolSaturationError(error)) {
    return true;
  }

  if (
    isPrismaErrorOfType<Prisma.PrismaClientKnownRequestError>(
      error,
      Prisma.PrismaClientKnownRequestError
    )
  ) {
    return TRANSIENT_PRISMA_CODES.has(error.code);
  }

  const haystack = errorChainMessages(error).join(" ").toLowerCase();
  return (
    haystack.includes("econnreset") ||
    haystack.includes("etimedout") ||
    haystack.includes("epipe") ||
    haystack.includes("can't reach database server") ||
    haystack.includes("server has closed the connection")
  );
}

export class DbCircuitOpenError extends Error {
  readonly code = "DB_CIRCUIT_OPEN";

  constructor(readonly retryAfterSec = 30) {
    super("DB_CIRCUIT_OPEN");
    this.name = "DbCircuitOpenError";
  }
}

/** Stable prefix for HTTP 503 mapping (not 500). */
export function asTransientDbServiceUnavailableError(error: unknown): Error {
  const base = error instanceof Error ? error.message : String(error);
  return new Error(`DB_TRANSIENT_UNAVAILABLE: ${base}`, {
    cause: error instanceof Error ? error : undefined,
  });
}
