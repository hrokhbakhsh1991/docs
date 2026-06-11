import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { validateDenaliRegistrationPayload } from "../denali.plugin";
import { isDenaliTourPublished } from "../catalog/denali-publish-status";
import { toDenaliCatalogCard } from "../catalog/denali-catalog-card";

import { DenaliRegistrationDuplicateError } from "./errors/denali-registration-conflict.error";
import { DenaliWorkspaceRequiredError } from "./errors/denali-workspace-required.error";
import type { DenaliPublicBookingPort } from "./ports/public-booking.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";
import type { DenaliRegistrationPostBody } from "./schemas/denali-registration-post.schema";

function readTourCapacity(canonical: CanonicalDocument): number | null {
  const data = canonical.data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const capacityMax = (data as Record<string, unknown>).capacityMax;
  return typeof capacityMax === "number" && Number.isFinite(capacityMax)
    ? Math.trunc(capacityMax)
    : null;
}

export async function createDenaliRegistration(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly guestUserId: string;
  readonly body: DenaliRegistrationPostBody;
  readonly store: DenaliTourStorePort;
  readonly bookingPort: DenaliPublicBookingPort;
}): Promise<{ readonly id: string; readonly status: string }> {
  if (params.workspaceType !== "denali") {
    throw new DenaliWorkspaceRequiredError();
  }

  const tour = await params.store.findFirst({
    tenantId: params.tenantId,
    id: params.body.tourId,
  });
  if (tour === null || !isDenaliTourPublished(tour.canonical)) {
    const err = new Error("ZOD_VALIDATION_FAILED");
    (err as Error & { details?: unknown }).details = { tourId: ["TOUR_NOT_PUBLISHED"] };
    throw err;
  }

  const capacity = readTourCapacity(tour.canonical);
  validateDenaliRegistrationPayload(
    {
      contact: params.body.contact,
      partySize: params.body.partySize,
    },
    { capacity }
  );

  const duplicate = await params.bookingPort.findDuplicateByTourEmail(
    params.tenantId,
    params.body.tourId,
    params.body.contact.email
  );
  if (duplicate !== null) {
    throw new DenaliRegistrationDuplicateError();
  }

  const card = toDenaliCatalogCard(tour);
  const departureAt = card.departureAt?.trim();
  if (departureAt === undefined || departureAt.length === 0) {
    const err = new Error("ZOD_VALIDATION_FAILED");
    (err as Error & { details?: unknown }).details = { tourId: ["TOUR_DEPARTURE_NOT_SET"] };
    throw err;
  }

  return params.bookingPort.createPendingBooking({
    tenantId: params.tenantId,
    guestUserId: params.guestUserId,
    tourId: params.body.tourId,
    tourTitle: card.title,
    guestLabel: params.body.contact.fullName,
    guestEmail: params.body.contact.email,
    ...(params.body.contact.phone !== undefined ? { guestPhone: params.body.contact.phone } : {}),
    partySize: params.body.partySize,
    departureAt,
  });
}
