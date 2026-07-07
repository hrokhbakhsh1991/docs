import type { IntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";
import type { EnqueueIntegrationDeliveryJobInput } from "../platform/integration-delivery.types";

/**
 * Idempotent enqueue — duplicate (tenant, provider, capability, domainEventId) is a no-op.
 */
export async function enqueueIntegrationDeliveryJob(
  repository: IntegrationDeliveryRepository,
  input: EnqueueIntegrationDeliveryJobInput
): Promise<boolean> {
  return repository.enqueueJob(input);
}
