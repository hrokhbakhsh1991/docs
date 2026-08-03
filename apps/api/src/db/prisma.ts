import { PrismaClient } from "@prisma/client";

import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { PRODUCTION_DATABASE_URL_ADMIN_REQUIRED } from "../server/production-env-codes";
import { requiresProductionGradeIntegrity } from "../server/runtime-profile";

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
 * Production/prodlike: throws when admin URL missing (DI-PRISMA-01 / hostile audit P2).
 * Non-integrity: falls back to app pool only for local dev without admin URL.
 */
export function getPrismaAdmin(): PrismaClient {
  const adminUrl = process.env.DATABASE_URL_ADMIN?.trim();
  if (!adminUrl) {
    if (requiresProductionGradeIntegrity() || isProductionAuthMode()) {
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

/**
 * Test-only — install a query-logging `PrismaClient` as the `getPrisma()` singleton
 * so repository SQL can be asserted via `$on("query")` (BK-PAGE-04/05, PERF-*, STRESS-07).
 *
 * Dispose contract (see `installQueryCapture` in booking list specs): call the returned
 * restore, then `disconnectPrisma()`. Restore leaves the binding installed so
 * `disconnectPrisma()` closes the capture client and clears the singleton.
 */
export function __testBindPrismaClientForQueryCapture(
  binding: PrismaClient
): () => Promise<void> {
  client = binding;
  return async () => {
    // Singleton stays on `binding` until `disconnectPrisma()`.
  };
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
