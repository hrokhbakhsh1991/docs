import type { WorkspaceOutboxPublishedRow } from "../../workspace/workspace-outbox-row-context";

/**
 * Resolves the enrichment payload for integration dispatch.
 * TourPublished v1 events carry a frozen deliverySnapshot (Stripe data.object equivalent).
 */
export function resolveIntegrationDispatchPayload(
  row: WorkspaceOutboxPublishedRow,
): Readonly<Record<string, unknown>> {
  const raw =
    typeof row.payload === "object" && row.payload !== null
      ? (row.payload as Record<string, unknown>)
      : {};

  const snapshot = raw.deliverySnapshot;
  const tourId =
    typeof raw.tourId === "string"
      ? raw.tourId
      : typeof raw.aggregateId === "string"
        ? raw.aggregateId
        : row.aggregateId;

  const base: Record<string, unknown> = {
    ...raw,
    tenantId: raw.tenantId ?? row.tenantId,
    tourId,
    aggregateId: row.aggregateId,
  };

  if (typeof snapshot === "object" && snapshot !== null && !Array.isArray(snapshot)) {
    return {
      ...base,
      ...(snapshot as Record<string, unknown>),
    };
  }

  return base;
}
