import { publishDomainEvent } from "@app-tour/platform-events";

import { getActiveTenantId } from "../tenant/tenant-request-context";

export type TourCreatedPayload = {
  readonly tourId: string;
};

/**
 * P4-E-EVT-01 — in-process TourCreated; forbidden when ALS tenant ≠ persisted tenant.
 */
export function publishTourCreatedEvent(input: {
  readonly tenantId: string;
  readonly tourId: string;
}): void {
  const activeTenantId = getActiveTenantId();
  if (activeTenantId !== undefined && activeTenantId !== input.tenantId) {
    throw new Error("DOMAIN_EVENT_CROSS_TENANT_FORBIDDEN");
  }

  publishDomainEvent<TourCreatedPayload>({
    tenantId: input.tenantId,
    type: "TourCreated",
    payload: { tourId: input.tourId },
  });
}
