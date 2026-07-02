import { getIntegrationProvider } from "../platform/integration-provider-registry";
import type { IntegrationDeliveryJobRecord } from "../platform/integration-delivery.types";
import type { IntegrationDeliveryContext } from "../platform/integration-provider.types";
import type { IntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";
import { resolveDeliveryConnection } from "../application/resolve-integration-connection-credentials";
import { formatIntegrationDeliveryMessage } from "../platform/format-integration-delivery-message";
import { computeRelayBackoff } from "../../resilience/compute-relay-backoff";
import {
  recordIntegrationDeliveryFailed,
  recordIntegrationDeliverySuccess,
} from "../../observability/metrics";
import { reclaimStaleProcessingIntegrationDeliveryJobs } from "./integration-delivery-processing-reclaim";

const MAX_DELIVERY_ATTEMPTS = 8;

export type ProcessIntegrationDeliveryDeps = {
  readonly deliveryRepository: IntegrationDeliveryRepository;
};

function deliveryFailureReason(error: Record<string, unknown> | undefined): string {
  return typeof error?.code === "string" && error.code.trim().length > 0
    ? error.code
    : "INTEGRATION_DELIVERY_FAILED";
}

export async function executeIntegrationDeliveryJob(
  job: IntegrationDeliveryJobRecord
): Promise<{ readonly ok: boolean; readonly error?: Record<string, unknown> }> {
  const adapter = getIntegrationProvider(job.provider);
  if (adapter === undefined) {
    return { ok: false, error: { code: "INTEGRATION_PROVIDER_NOT_REGISTERED" } };
  }

  const workspaceType =
    typeof job.payload.workspaceType === "string" ? job.payload.workspaceType : null;
  const connectionId =
    typeof job.payload.integrationConnectionId === "string"
      ? job.payload.integrationConnectionId
      : null;

  const connection =
    connectionId !== null
      ? await resolveDeliveryConnection({
          tenantId: job.tenantId,
          connectionId,
          workspaceType,
        })
      : null;

  if (connection === null) {
    return { ok: false, error: { code: "INTEGRATION_CONNECTION_NOT_FOUND" } };
  }

  const ctx: IntegrationDeliveryContext = {
    tenantId: job.tenantId,
    workspaceType,
    domainEventId: job.domainEventId,
    eventType: job.eventType,
    config: connection.config,
    credentials: connection.credentials,
  };

  const channelId =
    typeof connection.config.channelId === "string" ? connection.config.channelId : null;

  if (job.capability === "message.send") {
    if (channelId === null) {
      return { ok: false, error: { code: "INTEGRATION_CONFIG_INCOMPLETE" } };
    }
    const result = await adapter.sendMessage(ctx, {
      channelId,
      text: formatIntegrationDeliveryMessage({
        workspaceType,
        eventType: job.eventType,
        payload: job.payload,
      }),
    });
    return result.ok
      ? { ok: true }
      : { ok: false, error: { code: result.errorCode, message: result.errorMessage } };
  }

  if (job.capability === "channel.create" && adapter.createChannelLink !== undefined) {
    const tourId =
      typeof job.payload.tourId === "string"
        ? job.payload.tourId
        : String(job.payload.aggregateId ?? "");
    const title =
      typeof job.payload.title === "string" && job.payload.title.trim().length > 0
        ? job.payload.title
        : `Tour ${tourId}`;
    const result = await adapter.createChannelLink(ctx, { title, tourId });
    return result.ok
      ? { ok: true }
      : { ok: false, error: { code: result.errorCode, message: result.errorMessage } };
  }

  return { ok: false, error: { code: "INTEGRATION_CAPABILITY_UNSUPPORTED" } };
}

export async function processIntegrationDeliveryOnce(
  deps: ProcessIntegrationDeliveryDeps,
  batchSize = readIntegrationDeliveryBatchSize()
): Promise<{
  readonly claimed: number;
  readonly done: number;
  readonly retried: number;
  readonly dead: number;
  readonly reclaimed: number;
}> {
  const reclaimed = await reclaimStaleProcessingIntegrationDeliveryJobs();
  const claimed = await deps.deliveryRepository.claimPendingBatch(batchSize);
  let done = 0;
  let retried = 0;
  let dead = 0;

  for (const job of claimed) {
    let outcome: { readonly ok: boolean; readonly error?: Record<string, unknown> };
    try {
      outcome = await executeIntegrationDeliveryJob(job);
    } catch (error: unknown) {
      outcome = {
        ok: false,
        error: {
          code: "INTEGRATION_DELIVERY_UNHANDLED",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
    if (outcome.ok) {
      await deps.deliveryRepository.markDone(job.tenantId, job.id);
      recordIntegrationDeliverySuccess({
        tenantId: job.tenantId,
        provider: job.provider,
        capability: job.capability,
      });
      done += 1;
      continue;
    }

    const nextAttempt = job.attemptCount + 1;
    const lastError = outcome.error ?? { code: "INTEGRATION_DELIVERY_FAILED" };
    recordIntegrationDeliveryFailed({
      tenantId: job.tenantId,
      provider: job.provider,
      capability: job.capability,
      reason: deliveryFailureReason(outcome.error),
    });

    if (nextAttempt >= MAX_DELIVERY_ATTEMPTS) {
      await deps.deliveryRepository.markDead({
        tenantId: job.tenantId,
        jobId: job.id,
        lastError,
      });
      dead += 1;
      continue;
    }

    const delayMs = computeRelayBackoff({
      attempt: nextAttempt,
      baseMs: readIntegrationDeliveryBackoffBaseMs(),
      maxMs: readIntegrationDeliveryBackoffMaxMs(),
    });
    await deps.deliveryRepository.markFailedForRetry({
      tenantId: job.tenantId,
      jobId: job.id,
      attemptCount: nextAttempt,
      nextAttemptAt: new Date(Date.now() + delayMs),
      lastError,
    });
    retried += 1;
  }

  return { claimed: claimed.length, done, retried, dead, reclaimed };
}

export function readIntegrationDeliveryBatchSize(): number {
  const raw = process.env.INTEGRATION_DELIVERY_BATCH_SIZE?.trim();
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : 10;
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 50) : 10;
}

function readIntegrationDeliveryBackoffBaseMs(): number {
  const raw = process.env.INTEGRATION_DELIVERY_BACKOFF_BASE_MS?.trim();
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : 1000;
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1000;
}

function readIntegrationDeliveryBackoffMaxMs(): number {
  const base = readIntegrationDeliveryBackoffBaseMs();
  const raw = process.env.INTEGRATION_DELIVERY_BACKOFF_MAX_MS?.trim();
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : 60_000;
  return Number.isFinite(parsed) && parsed >= base ? parsed : 60_000;
}
