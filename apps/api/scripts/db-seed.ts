/**
 * Phase 4.3 — idempotent dev tenant seed (`tenant-a`, `tenant-b`).
 *
 * Run: NODE_ENV=development DATABASE_URL=... DATABASE_URL_ADMIN=... pnpm --filter @apps/api run db:seed
 */
import { ProvisioningService } from "../src/internal/provisioning.service";
import { logger } from "../src/observability/logger";

async function main(): Promise<void> {
  const service = new ProvisioningService();
  const tenants = await service.seedDevTenants();
  for (const tenant of tenants) {
    logger.info({ event: "db.seed.tenant", subdomain: tenant.subdomain }, "dev tenant seeded");
  }
}

main().catch(() => {
  logger.error(
    { event: "db.seed.failed", code: "SEED_DEV_TENANTS_FAILED" },
    "dev tenant seed failed"
  );
  process.exit(1);
});
