import { PrismaClient } from "@prisma/client";

let client: PrismaClient | undefined;
let adminClient: PrismaClient | undefined;

/** Singleton Prisma client for @apps/api (STORAGE_DRIVER=prisma). */
export function getPrisma(): PrismaClient {
  if (client === undefined) {
    client = new PrismaClient();
  }
  return client;
}

/** CASL id-only probe — uses DATABASE_URL_ADMIN when set (bypasses RLS as DB owner). */
export function getPrismaAdmin(): PrismaClient {
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  if (!adminUrl) {
    return getPrisma();
  }
  if (adminClient === undefined) {
    adminClient = new PrismaClient({
      datasources: { db: { url: adminUrl } },
    });
  }
  return adminClient;
}

/** Test-only — disconnect and reset singleton. */
export async function disconnectPrisma(): Promise<void> {
  if (client !== undefined) {
    await client.$disconnect();
    client = undefined;
  }
  if (adminClient !== undefined) {
    await adminClient.$disconnect();
    adminClient = undefined;
  }
}
