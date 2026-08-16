/**
 * Prisma error constructors are not always objects (memory driver / empty DATABASE_URL).
 * Bare `error instanceof Prisma.PrismaClient*Error` then throws TypeError and exits Node.
 */
export function isPrismaErrorOfType<T>(error: unknown, ctor: unknown): error is T {
  return typeof ctor === "function" && error instanceof (ctor as new (...args: never[]) => object);
}
