/**
 * MNI-001 — relay all pending outbox rows for one tenant (browser notification proof).
 */
import { execSync } from "node:child_process";
import path from "node:path";

export function relayTenantOutboxForTenant(tenantId: string): void {
  const repoRoot = path.resolve(__dirname, "../../../../..");
  execSync(
    "pnpm --filter @apps/api exec node --import tsx scripts/run-tenant-outbox-relay-once.ts",
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        TENANT_OUTBOX_RELAY_TENANT_ID: tenantId,
        STORAGE_DRIVER: "prisma",
        PAYMENT_HOLD_ENABLED: "true",
      },
      stdio: "inherit",
    },
  );
}
