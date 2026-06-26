import { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import type {
  EnqueueIntegrationDeliveryJobInput,
  IntegrationDeliveryJobRecord,
} from "../platform/integration-delivery.types";
import type { IntegrationCapability } from "../platform/integration-capability";
import type { IntegrationProviderId } from "../platform/integration-provider.types";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type IntegrationDeliveryRepository = {
  enqueueJob(input: EnqueueIntegrationDeliveryJobInput): Promise<boolean>;
  claimPendingBatch(batchSize: number): Promise<readonly IntegrationDeliveryJobRecord[]>;
  markDone(tenantId: string, jobId: string): Promise<void>;
  markFailedForRetry(input: {
    readonly tenantId: string;
    readonly jobId: string;
    readonly attemptCount: number;
    readonly nextAttemptAt: Date;
    readonly lastError: Record<string, unknown>;
  }): Promise<void>;
  markDead(input: {
    readonly tenantId: string;
    readonly jobId: string;
    readonly lastError: Record<string, unknown>;
  }): Promise<void>;
};

export class PrismaIntegrationDeliveryRepository implements IntegrationDeliveryRepository {
  async enqueueJob(input: EnqueueIntegrationDeliveryJobInput): Promise<boolean> {
    return withTenantRls(input.tenantId, async (tx) => {
      try {
        await tx.integrationDeliveryJob.create({
          data: {
            tenantId: input.tenantId,
            provider: input.provider,
            capability: input.capability,
            domainEventId: input.domainEventId,
            eventType: input.eventType,
            payload: input.payload as Prisma.InputJsonValue,
            status: "pending",
          },
        });
        return true;
      } catch (error: unknown) {
        if (isUniqueViolation(error)) {
          return false;
        }
        throw error;
      }
    });
  }

  async claimPendingBatch(batchSize: number): Promise<readonly IntegrationDeliveryJobRecord[]> {
    const normalizedBatch = Math.max(1, Math.min(batchSize, 50));
    const tenantId = readIntegrationWorkerTenantScope();
    if (tenantId !== null) {
      return claimPendingForTenant(tenantId, normalizedBatch);
    }
    return claimPendingGlobal(normalizedBatch);
  }

  async markDone(tenantId: string, jobId: string): Promise<void> {
    await withTenantRls(tenantId, async (tx) => {
      await tx.integrationDeliveryJob.update({
        where: { id: jobId },
        data: { status: "done", processedAt: new Date() },
      });
    });
  }

  async markFailedForRetry(input: {
    readonly tenantId: string;
    readonly jobId: string;
    readonly attemptCount: number;
    readonly nextAttemptAt: Date;
    readonly lastError: Record<string, unknown>;
  }): Promise<void> {
    await withTenantRls(input.tenantId, async (tx) => {
      await tx.integrationDeliveryJob.update({
        where: { id: input.jobId },
        data: {
          status: "pending",
          attemptCount: input.attemptCount,
          nextAttemptAt: input.nextAttemptAt,
          lastError: input.lastError as Prisma.InputJsonValue,
        },
      });
    });
  }

  async markDead(input: {
    readonly tenantId: string;
    readonly jobId: string;
    readonly lastError: Record<string, unknown>;
  }): Promise<void> {
    await withTenantRls(input.tenantId, async (tx) => {
      await tx.integrationDeliveryJob.update({
        where: { id: input.jobId },
        data: {
          status: "dead",
          processedAt: new Date(),
          lastError: input.lastError as Prisma.InputJsonValue,
        },
      });
    });
  }
}

function readIntegrationWorkerTenantScope(): string | null {
  const raw = process.env.INTEGRATION_DELIVERY_TENANT_SCOPE?.trim();
  return raw !== undefined && raw.length > 0 ? raw : null;
}

async function claimPendingGlobal(
  batchSize: number
): Promise<readonly IntegrationDeliveryJobRecord[]> {
  const { getPrismaAdmin } = await import("../../db/prisma");
  const admin = getPrismaAdmin();
  return admin.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      {
        id: string;
        tenantId: string;
        provider: string;
        capability: string;
        domainEventId: string;
        eventType: string;
        payload: Prisma.JsonValue;
        status: string;
        attemptCount: number;
        nextAttemptAt: Date | null;
      }[]
    >`
      SELECT
        id::text AS id,
        tenant_id::text AS "tenantId",
        provider,
        capability,
        domain_event_id AS "domainEventId",
        event_type AS "eventType",
        payload,
        status,
        attempt_count AS "attemptCount",
        next_attempt_at AS "nextAttemptAt"
      FROM integration_delivery_jobs
      WHERE status = 'pending'
        AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
      ORDER BY created_at ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) {
      return [];
    }

    await tx.integrationDeliveryJob.updateMany({
      where: {
        OR: rows.map((row) => ({ id: row.id, tenantId: row.tenantId })),
      },
      data: { status: "processing" },
    });

    return rows.map(mapDeliveryRow);
  });
}

async function claimPendingForTenant(
  tenantId: string,
  batchSize: number
): Promise<readonly IntegrationDeliveryJobRecord[]> {
  const { getPrismaAdmin } = await import("../../db/prisma");
  const admin = getPrismaAdmin();
  return admin.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      {
        id: string;
        tenantId: string;
        provider: string;
        capability: string;
        domainEventId: string;
        eventType: string;
        payload: Prisma.JsonValue;
        status: string;
        attemptCount: number;
        nextAttemptAt: Date | null;
      }[]
    >`
      SELECT
        id::text AS id,
        tenant_id::text AS "tenantId",
        provider,
        capability,
        domain_event_id AS "domainEventId",
        event_type AS "eventType",
        payload,
        status,
        attempt_count AS "attemptCount",
        next_attempt_at AS "nextAttemptAt"
      FROM integration_delivery_jobs
      WHERE status = 'pending'
        AND tenant_id = ${tenantId}::uuid
        AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
      ORDER BY created_at ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) {
      return [];
    }

    await tx.integrationDeliveryJob.updateMany({
      where: {
        tenantId,
        id: { in: rows.map((row) => row.id) },
      },
      data: { status: "processing" },
    });

    return rows.map(mapDeliveryRow);
  });
}

function mapDeliveryRow(row: {
  id: string;
  tenantId: string;
  provider: string;
  capability: string;
  domainEventId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  status: string;
  attemptCount: number;
  nextAttemptAt: Date | null;
}): IntegrationDeliveryJobRecord {
  const payload =
    typeof row.payload === "object" && row.payload !== null
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    tenantId: row.tenantId,
    provider: row.provider as IntegrationProviderId,
    capability: row.capability as IntegrationCapability,
    domainEventId: row.domainEventId,
    eventType: row.eventType,
    payload,
    status: row.status as IntegrationDeliveryJobRecord["status"],
    attemptCount: row.attemptCount,
    nextAttemptAt: row.nextAttemptAt,
  };
}

export function createIntegrationDeliveryRepository(): IntegrationDeliveryRepository {
  return new PrismaIntegrationDeliveryRepository();
}
