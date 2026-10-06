import { createIntegrationConnectionRepository } from "../infrastructure/prisma-integration-connection.repository";
import { enqueueIntegrationDeliveryJob } from "./enqueue-integration-delivery-job";
import { PrismaIntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";
import type { IntegrationConnectionRecord } from "../platform/integration-connection.types";
import type { EnqueueIntegrationDeliveryJobInput } from "../platform/integration-delivery.types";

export async function resolveOtpDeliveryConnection(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
}): Promise<IntegrationConnectionRecord | null> {
  return createIntegrationConnectionRepository().findEnabledForTenant({
    tenantId: input.tenantId,
    provider: "melipayamak",
    workspaceType: input.workspaceType,
  });
}

export function enqueueOtpDeliveryJob(
  input: EnqueueIntegrationDeliveryJobInput
): Promise<boolean> {
  return enqueueIntegrationDeliveryJob(new PrismaIntegrationDeliveryRepository(), input);
}
