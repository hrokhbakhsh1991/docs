/**
 * WRS Phase 5 — idempotent dev seed for denali.club custom apex rows.
 *
 * Run:
 *   pnpm --filter @apps/api run seed:wrs-denali-club-domains
 *
 * Then:
 *   P6_WRS_EXPECT_TENANT_ID=00000000-0000-4000-8000-000000000003 pnpm run smoke:wrs-custom-apex
 */
import { getPrismaAdmin } from "../src/db/prisma.ts";
import { logger } from "../src/observability/logger.ts";

const DENALI_TENANT_ID = "00000000-0000-4000-8000-000000000003";

const WRS_DEV_CUSTOM_APEX = [
  {
    hostname: "denali.club",
    surface: "marketing",
    cnameTarget: "dev-ingress.marketing.localhost",
  },
  {
    hostname: "portal.denali.club",
    surface: "portal",
    cnameTarget: "dev-ingress.portal.localhost",
  },
  {
    hostname: "admin.denali.club",
    surface: "admin",
    cnameTarget: "dev-ingress.admin.localhost",
  },
] as const;

async function main(): Promise<void> {
  const prisma = getPrismaAdmin();
  const tenant = await prisma.tenant.findUnique({
    where: { id: DENALI_TENANT_ID },
    select: { id: true, subdomain: true },
  });
  if (tenant === null) {
    throw new Error(
      `denali tenant ${DENALI_TENANT_ID} not found — run pnpm --filter @apps/api run db:seed first`
    );
  }

  for (const row of WRS_DEV_CUSTOM_APEX) {
    await prisma.tenantDomain.upsert({
      where: { hostname: row.hostname },
      create: {
        tenantId: DENALI_TENANT_ID,
        hostname: row.hostname,
        surface: row.surface,
        cnameTarget: row.cnameTarget,
        status: "verified",
        verifiedAt: new Date(),
        sslStatus: "active",
      },
      update: {
        tenantId: DENALI_TENANT_ID,
        surface: row.surface,
        cnameTarget: row.cnameTarget,
        status: "verified",
        verifiedAt: new Date(),
        sslStatus: "active",
        sslLastError: null,
      },
    });
    logger.info(
      { event: "wrs.seed.custom_apex", hostname: row.hostname, tenantId: DENALI_TENANT_ID },
      "custom apex domain seeded"
    );
  }

  logger.info({ event: "wrs.seed.custom_apex.done", subdomain: tenant.subdomain }, "WRS denali.club dev domains ready");
}

main().catch((error: unknown) => {
  logger.error(
    {
      event: "wrs.seed.custom_apex.failed",
      err: error instanceof Error ? error.message : String(error),
    },
    "WRS denali.club domain seed failed"
  );
  process.exit(1);
});
