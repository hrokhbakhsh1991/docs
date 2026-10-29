import { ProvisioningService } from "../src/internal/provisioning.service";
import {
  PLATFORM_ADMIN_REASON,
  getPlatformAdminClient,
} from "../src/platform/platform-admin-client";
import { assertSecondTenantStagingTarget } from "./lib/denali-second-staging-target";
import {
  resolveSecondStagingTenantExistingRecord,
  toSecondStagingTenantProvisionInput,
} from "./lib/denali-second-staging-identity";

const TENANT_SUBDOMAIN = "denali-qa2";
const TENANT_ID = "f0ed9e65-2638-4351-847d-724f87ebbfce";
const TENANT_WORKSPACE_TYPE = "denali";
const TENANT_STATUS = "active";
const TENANT_THEME = {
  commerce: {
    currency: "IRR",
    paymentMode: "offline_receipt",
    gatewayProvider: null,
    frozen: true,
  },
  defaultLocale: "fa",
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply") || args.length > 1) {
    throw new Error("Usage: seed-denali-second-staging-tenant.ts [--apply]");
  }

  const apply = args.includes("--apply");
  assertSecondTenantStagingTarget(process.env, apply);
  if (!apply) {
    console.log(
      `DENALI_SECOND_STAGING_TENANT_DRY_RUN_OK database=tour_db_staging subdomain=${TENANT_SUBDOMAIN} tenantId=${TENANT_ID}`
    );
    return;
  }

  const prisma = getPlatformAdminClient(PLATFORM_ADMIN_REASON.PLATFORM_PROVISION);
  const [byId, bySubdomain] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: TENANT_ID },
      select: { id: true, subdomain: true, workspaceType: true, status: true },
    }),
    prisma.tenant.findUnique({
      where: { subdomain: TENANT_SUBDOMAIN },
      select: { id: true, subdomain: true, workspaceType: true, status: true },
    }),
  ]);
  const expected = {
    id: TENANT_ID,
    subdomain: TENANT_SUBDOMAIN,
    workspaceType: TENANT_WORKSPACE_TYPE,
    status: TENANT_STATUS,
  };
  const existing = resolveSecondStagingTenantExistingRecord(byId, bySubdomain, expected);
  const tenant =
    existing ??
    (await new ProvisioningService().provisionTenantProduction({
      ...toSecondStagingTenantProvisionInput(expected),
      theme: TENANT_THEME,
    }));
  console.log(
    `DENALI_SECOND_STAGING_TENANT_SEED_OK subdomain=${tenant.subdomain} tenantId=${tenant.id} status=${tenant.status} action=${existing === null ? "created" : "already-present"}`
  );
}

main().catch((error: unknown) => {
  const safeCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{1,80}$/.test(error.code)
      ? error.code
      : undefined;
  const safeMessage =
    error instanceof Error && /^[A-Z0-9_]{1,80}$/.test(error.message) ? error.message : undefined;
  console.error(safeCode ?? safeMessage ?? "DENALI_SECOND_STAGING_TENANT_SEED_FAILED");
  process.exitCode = 1;
});
