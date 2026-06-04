import { PrismaClient } from "@prisma/client";

let client: PrismaClient | undefined;

/** Singleton Prisma client for @apps/api (STORAGE_DRIVER=prisma). */
export function getPrisma(): PrismaClient {
  if (client === undefined) {
    client = new PrismaClient();
  }
  return client;
}

/** Test-only — disconnect and reset singleton. */
export async function disconnectPrisma(): Promise<void> {
  if (client !== undefined) {
    await client.$disconnect();
    client = undefined;
  }
}
