import { PrismaClient } from "@prisma/client";

import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { PRODUCTION_DATABASE_URL_ADMIN_REQUIRED } from "../server/production-runtime-env";

let client: PrismaClient | undefined;
let adminClient: PrismaClient | undefined;

/** Tenant I/O — uses `DATABASE_URL` app role (must be NOBYPASSRLS in production; DM-CT-02). */
export function getPrisma(): PrismaClient {
  if (client === undefined) {
    client = new PrismaClient();
  }
  return client;
}

/**
 * Admin / owner pool — `DATABASE_URL_ADMIN` only.
 * Production: throws when admin URL missing (DI-PRISMA-01).
 * Non-production: falls back to app pool only for local dev without admin URL.
 */
export function getPrismaAdmin(): PrismaClient {
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  if (!adminUrl) {
    if (isProductionAuthMode()) {
      throw new Error(PRODUCTION_DATABASE_URL_ADMIN_REQUIRED);
    }
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
