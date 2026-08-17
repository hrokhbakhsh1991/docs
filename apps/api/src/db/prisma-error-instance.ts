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
