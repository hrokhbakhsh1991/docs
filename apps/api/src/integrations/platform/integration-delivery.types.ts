import type { IntegrationCapability } from "./integration-capability";
import type { IntegrationProviderId } from "./integration-provider.types";

export type IntegrationDeliveryJobStatus = "pending" | "processing" | "done" | "failed" | "dead";

export type IntegrationDeliveryJobRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly provider: IntegrationProviderId;
  readonly capability: IntegrationCapability;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly status: IntegrationDeliveryJobStatus;
  readonly attemptCount: number;
  readonly nextAttemptAt: Date | null;
};

export type EnqueueIntegrationDeliveryJobInput = {
  readonly tenantId: string;
  readonly provider: IntegrationProviderId;
  readonly capability: IntegrationCapability;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
};
