import type { DomainEventEnvelope } from "@app-tour/platform-events";

import { getPrismaAdmin } from "../db/prisma";

export type TourCreatedEventPayload = {
  readonly tourId?: string;
  readonly tenantId?: string;
};

/**
 * Thrown when a TourCreated envelope fails zero-trust tenant consistency (Pillar 1).
 * Name is stable for pentest / reliability specs (`error.name === "SecurityViolation"`).
 */
export class SecurityViolation extends Error {
  constructor(message = "TourCreated envelope failed tenant consistency check") {
    super(message);
    this.name = "SecurityViolation";
  }
}

function readPayloadTenantId(payload: TourCreatedEventPayload): string | undefined {
  const raw = payload.tenantId;
  if (typeof raw !== "string") {
    return undefined;
  }
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Synchronous guard — envelope `tenantId` must match optional `payload.tenantId`.
 */
export function assertTourCreatedEnvelopeTenantParity(
  envelope: DomainEventEnvelope<TourCreatedEventPayload>
): void {
  const payloadTenantId = readPayloadTenantId(envelope.payload ?? {});
  if (payloadTenantId !== undefined && payloadTenantId !== envelope.tenantId) {
    throw new SecurityViolation("TourCreated payload.tenantId disagrees with envelope.tenantId");
  }

  const tourId = envelope.payload?.tourId?.trim();
  if (tourId !== undefined && tourId.length === 0) {
    throw new SecurityViolation("TourCreated payload.tourId is empty");
  }
}

/**
 * When Postgres is available, `tourId` must exist under `envelope.tenantId` (aggregate ownership).
 */
export async function assertTourCreatedAggregateOwnership(
  envelope: DomainEventEnvelope<TourCreatedEventPayload>
): Promise<void> {
  assertTourCreatedEnvelopeTenantParity(envelope);

  const tourId = envelope.payload?.tourId?.trim();
  if (!tourId) {
    throw new SecurityViolation("TourCreated payload.tourId is required for ownership check");
  }

  const admin = getPrismaAdmin();
  const owned = await admin.tour.findFirst({
    where: { id: tourId, tenantId: envelope.tenantId },
    select: { id: true },
  });
  if (owned === null) {
    throw new SecurityViolation("TourCreated tourId is not owned by envelope tenantId");
  }
}

export async function assertTourCreatedDeliverySafe(
  envelope: DomainEventEnvelope<TourCreatedEventPayload>
): Promise<void> {
  assertTourCreatedEnvelopeTenantParity(envelope);

  if (!process.env.DATABASE_URL?.trim()) {
    return;
  }

  await assertTourCreatedAggregateOwnership(envelope);
}
