/**
 * WALLET-V1 — relay wallet outbox rows for browser notification proof.
 */
import { execSync } from "node:child_process";
import path from "node:path";

export function relayWalletOutboxForTenant(tenantId: string): void {
  const repoRoot = path.resolve(__dirname, "../../../../..");
  execSync("pnpm --filter @apps/api exec node --import tsx scripts/run-wallet-outbox-relay-once.ts", {
    cwd: repoRoot,
    env: {
      ...process.env,
      WALLET_OUTBOX_RELAY_TENANT_ID: tenantId,
      STORAGE_DRIVER: "prisma",
    },
    stdio: "inherit",
  });
}
