import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { TourProjectionFields } from "./projection-sync";

export const TOUR_PUBLISHED_OUTBOX_PAYLOAD_SCHEMA_VERSION = 1 as const;

export type TourPublishedOutboxPayload = {
  readonly schemaVersion: typeof TOUR_PUBLISHED_OUTBOX_PAYLOAD_SCHEMA_VERSION;
  readonly tenantId: string;
  readonly tourId: string;
  readonly rowVersion: number;
  readonly publishStatus: string;
  readonly title: string | null;
  readonly occurredAt: string;
  readonly deliverySnapshot: Readonly<Record<string, unknown>>;
};

export function buildTourPublishedDomainEventId(tourId: string, rowVersion: number): string {
  return `TourPublished:${tourId}:${rowVersion}`;
}

function readCanonicalDataRecord(
  canonical: CanonicalDocument,
): Readonly<Record<string, unknown>> {
  const data = canonical.data;
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return data as Readonly<Record<string, unknown>>;
  }
  return {};
}

/** Workspace publish labels that mean "publicly visible" for integration dispatch. */
export function isPublicPublishStatusLabel(label: string | undefined): boolean {
  if (label === undefined) {
    return false;
  }
  const normalized = label.trim().toLowerCase();
  return normalized === "active" || normalized === "published";
}

export function buildTourPublishedOutboxPayload(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly rowVersion: number;
  readonly canonical: CanonicalDocument;
  readonly projections: TourProjectionFields;
  readonly publishStatusLabel: string;
  readonly occurredAt: Date;
}): TourPublishedOutboxPayload {
  return {
    schemaVersion: TOUR_PUBLISHED_OUTBOX_PAYLOAD_SCHEMA_VERSION,
    tenantId: input.tenantId,
    tourId: input.tourId,
    rowVersion: input.rowVersion,
    publishStatus: input.publishStatusLabel,
    title: input.projections.title,
    occurredAt: input.occurredAt.toISOString(),
    deliverySnapshot: readCanonicalDataRecord(input.canonical),
  };
}
