/**
 * Postgres fixtures for portal ticketing Playwright smoke (operator tenant …000014).
 */
import { PrismaClient } from "@prisma/client";

import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository";
import {
  OPERATOR_SMOKE_TENANT_ID,
  seedOperatorSmokeCatalog,
} from "../src/settings/seed-operator-smoke-catalog";
import {
  ensureOperatorSmokePublishedTourEditReady,
  seedOperatorSmokePublishedTour,
} from "../src/settings/seed-operator-smoke-published-tour";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";

const OPERATOR_SMOKE_TENANT_ID_CONST = "00000000-0000-4000-8000-000000000014";

async function enableTicketingModule(admin: PrismaClient): Promise<void> {
  const row = await admin.tenant.findUnique({
    where: { id: OPERATOR_SMOKE_TENANT_ID_CONST },
    select: { theme: true },
  });
  const theme =
    row?.theme !== null && typeof row?.theme === "object" && !Array.isArray(row.theme)
      ? { ...(row.theme as Record<string, unknown>) }
      : {};
  const enabledModules = Array.isArray(theme.enabledModules)
    ? [
        ...new Set([
          ...theme.enabledModules.filter((v): v is string => typeof v === "string"),
          "ticketing",
        ]),
      ]
    : ["ticketing"];
  await admin.tenant.upsert({
    where: { id: OPERATOR_SMOKE_TENANT_ID_CONST },
    create: {
      id: OPERATOR_SMOKE_TENANT_ID_CONST,
      subdomain: "operator",
      workspaceType: "denali",
      theme: { ...theme, enabledModules },
    },
    update: {
      theme: { ...theme, enabledModules },
    },
  });
}

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!adminUrl?.trim()) {
    throw new Error("seed-portal-ticketing-e2e-fixtures: DATABASE_URL_ADMIN required");
  }

  const admin = new PrismaClient({ datasourceUrl: adminUrl });
  try {
    await admin.$executeRawUnsafe(`GRANT SELECT ON TABLE "_prisma_migrations" TO app_tour`);
    await enableTicketingModule(admin);

    await runWithTenantContext(OPERATOR_SMOKE_TENANT_ID, async () => {
      const repo = getSettingsResourcesRepository();
      await seedOperatorSmokeCatalog(repo, { tenantId: OPERATOR_SMOKE_TENANT_ID });
      await seedOperatorSmokePublishedTour(OPERATOR_SMOKE_TENANT_ID);
      await ensureOperatorSmokePublishedTourEditReady(OPERATOR_SMOKE_TENANT_ID);
    });

    console.log("seed-portal-ticketing-e2e-fixtures: operator smoke + ticketing ready");
  } finally {
    await admin.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
