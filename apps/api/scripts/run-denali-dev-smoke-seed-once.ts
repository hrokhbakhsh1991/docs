import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository";
import { seedOperatorSmokeCatalog } from "../src/settings/seed-operator-smoke-catalog";
import { seedOperatorSmokePublishedTour } from "../src/settings/seed-operator-smoke-published-tour";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";

async function main(): Promise<void> {
  await runWithTenantContext(DENALI_SMOKE_TENANT_ID, async () => {
    const repo = getSettingsResourcesRepository();
    await seedOperatorSmokeCatalog(repo, { tenantId: DENALI_SMOKE_TENANT_ID });
    await seedOperatorSmokePublishedTour(DENALI_SMOKE_TENANT_ID);
  });
  console.log("denali-dev-smoke-seed: ok");
}

main().catch((error: unknown) => {
  console.error("denali-dev-smoke-seed: failed", error);
  process.exit(1);
});
