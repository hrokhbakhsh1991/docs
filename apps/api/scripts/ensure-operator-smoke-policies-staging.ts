/**
 * P7-1-N-008 — idempotent policies backfill on operator smoke tour (staging VPS).
 */
import { ProvisioningService } from "../src/internal/provisioning.service.ts";
import { ensureOperatorSmokePublishedTourPolicies } from "../src/settings/seed-operator-smoke-published-tour.ts";

async function main(): Promise<void> {
  const service = new ProvisioningService();
  const operator = await service.seedOperatorSmokeTenant();
  await ensureOperatorSmokePublishedTourPolicies(operator.id);
  console.log("ENSURE_OPERATOR_SMOKE_POLICIES_OK", operator.id);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
