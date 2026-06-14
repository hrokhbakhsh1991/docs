import { Prisma } from "@prisma/client";

export const DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE";

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

/** Auth / credential / pool init failures — distinct from transient blips (DEC-094). */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1000") {
    return true;
  }

  const haystack = errorChainMessages(error).join(" ").toLowerCase();
  return (
    haystack.includes("password authentication failed") ||
    haystack.includes("authentication failed against database") ||
    haystack.includes("invalid connection string")
  );
}
