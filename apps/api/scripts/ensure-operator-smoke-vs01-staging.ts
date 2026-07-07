/**
 * P7-1-N-009 — ensure operator smoke published + draft fixtures for VS-01 staging probe.
 */
import { ProvisioningService } from "../src/internal/provisioning.service.ts";
import {
  ensureOperatorSmokePublishedTourPolicies,
  seedOperatorSmokeDraftTour,
  seedOperatorSmokeParticipantRequirementsTour,
  seedOperatorSmokePublishedTour,
  seedOperatorSmokeTransportTours,
} from "../src/settings/seed-operator-smoke-published-tour.ts";

async function main(): Promise<void> {
  const service = new ProvisioningService();
  const operator = await service.seedOperatorSmokeTenant();
  await seedOperatorSmokePublishedTour(operator.id);
  await ensureOperatorSmokePublishedTourPolicies(operator.id);
  await seedOperatorSmokeDraftTour(operator.id);
  await seedOperatorSmokeParticipantRequirementsTour(operator.id);
  await seedOperatorSmokeTransportTours(operator.id);
  console.log("ENSURE_OPERATOR_SMOKE_VS01_OK", operator.id);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
