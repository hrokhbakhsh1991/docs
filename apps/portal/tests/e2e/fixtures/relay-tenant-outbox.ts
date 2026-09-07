/**
 * MNI-001 — relay all pending outbox rows for one tenant (browser notification proof).
 */
import { execSync } from "node:child_process";
import path from "node:path";

export function relayTenantOutboxForTenant(tenantId: string): void {
  const repoRoot = path.resolve(__dirname, "../../../../..");
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    "postgresql://app_tour:app_tour@127.0.0.1:5432/app_tour_dev?connection_limit=32";
  const databaseUrlAdmin =
    process.env.DATABASE_URL_ADMIN?.trim() ||
    "postgresql://postgres:postgres@127.0.0.1:5432/app_tour_dev";
  execSync(
    "pnpm --filter @apps/api exec node --import tsx scripts/run-tenant-outbox-relay-once.ts",
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        TENANT_OUTBOX_RELAY_TENANT_ID: tenantId,
        STORAGE_DRIVER: "prisma",
        DATABASE_URL: databaseUrl,
        DATABASE_URL_ADMIN: databaseUrlAdmin,
        PAYMENT_HOLD_ENABLED: "true",
      },
      stdio: "inherit",
    },
  );
}
