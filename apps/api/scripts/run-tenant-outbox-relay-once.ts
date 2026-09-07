/**
 * Dev/E2E helper — process pending outbox rows for one tenant (all dispatchers).
 */
import { processOutboxRelayForTenantOnce } from "../src/outbox/outbox-relay";

async function main(): Promise<void> {
  const tenantId = process.env.TENANT_OUTBOX_RELAY_TENANT_ID?.trim();
  if (tenantId === undefined || tenantId.length === 0) {
    throw new Error("TENANT_OUTBOX_RELAY_TENANT_ID required");
  }
  if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error("DATABASE_URL + DATABASE_URL_ADMIN required");
  }
  process.env.STORAGE_DRIVER = "prisma";
  process.env.PAYMENT_HOLD_ENABLED = process.env.PAYMENT_HOLD_ENABLED ?? "true";
  const result = await processOutboxRelayForTenantOnce(tenantId, 50);
  console.log(JSON.stringify({ tenantId, ...result }));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
