/**
 * Thin Harbor G1 registration orchestration (PSR-6c4).
 * Booking persistence stays on host BookingPublicPort — no Denali clone.
 */
import type { BookingPublicPort } from "@app-tour/booking-http-contracts";
import {
  assertWorkspaceRegistrationContactBasics,
  assertWorkspaceTypeOrThrow,
  createTourDepartureNotSetValidationError,
  readWorkspaceCanonicalCapacityByPath,
  requireWorkspacePublishedTour,
  WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID,
} from "@app-tour/workspace-sdk";

import { HARBOR_WORKSPACE_TYPE } from "../harbor.plugin";
import { toHarborCatalogCard } from "../catalog/to-harbor-catalog-card";
import { resolveHarborRegistrationTourPublishVisibility } from "./harbor-registration-tour-publish-visibility";
import type { HarborTourStorePort } from "../http/harbor-http-host";
import { HarborRegistrationDuplicateError, HarborWorkspaceRequiredError } from "./harbor-registration.errors";

export type HarborRegistrationContact = {
  readonly fullName: string;
  readonly email: string;
  readonly phone?: string;
};

export type HarborRegistrationBody = {
  readonly tourId: string;
  readonly contact: HarborRegistrationContact;
  readonly partySize: number;
  readonly notes?: string;
};

function readHarborCapacity(canonical: {
  readonly data: unknown;
}): number | null {
  const flat = readWorkspaceCanonicalCapacityByPath(canonical, ["totalCapacity"]);
  if (flat !== null) return flat;
  const nested = readWorkspaceCanonicalCapacityByPath(canonical, [
    "tour",
    "capacity",
  ]);
  if (nested !== null) return nested;
  return readWorkspaceCanonicalCapacityByPath(canonical, ["capacity"]);
}

function invalidPayloadError(): Error {
  const err = new Error("ZOD_VALIDATION_FAILED") as Error & {
    details: Record<string, string[]>;
  };
  err.details = { contact: ["INVALID_PAYLOAD"] };
  return err;
}

export async function createHarborRegistration(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly guestUserId: string;
  readonly body: HarborRegistrationBody;
  readonly store: HarborTourStorePort;
  readonly bookingPort: BookingPublicPort;
}): Promise<{ readonly id: string; readonly status: string }> {
  assertWorkspaceTypeOrThrow(
    params.workspaceType,
    HARBOR_WORKSPACE_TYPE,
    () => new HarborWorkspaceRequiredError(),
  );

  const tour = await requireWorkspacePublishedTour({
    findFirst: () =>
      params.store.findFirst({
        tenantId: params.tenantId,
        id: params.body.tourId,
      }),
    isPublished: resolveHarborRegistrationTourPublishVisibility,
    getCanonical: (row) => row.canonical,
  });

  const capacity = readHarborCapacity(tour.canonical);
  assertWorkspaceRegistrationContactBasics({
    email: params.body.contact.email,
    emailRequired: true,
    fullName: params.body.contact.fullName,
    partySize: params.body.partySize,
    partySizeRequired: true,
    capacity,
    enforcePartySizeCapacity: capacity !== null,
    createInvalidError: invalidPayloadError,
  });

  const card = toHarborCatalogCard({
    id: tour.id,
    canonical: tour.canonical,
    catalogUpdatedAt: tour.createdAt,
  });
  const departureAt = card.departureAt?.trim() ?? "";
  if (departureAt.length === 0) {
    throw createTourDepartureNotSetValidationError();
  }

  const email = params.body.contact.email.trim();
  const duplicate = await params.bookingPort.findDuplicateByTourEmail(
    params.tenantId,
    params.body.tourId,
    email,
  );
  if (duplicate !== null) {
    throw new HarborRegistrationDuplicateError();
  }

  if (params.guestUserId !== WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID) {
    const byUser = await params.bookingPort.findDuplicateByTourGuest(
      params.tenantId,
      params.body.tourId,
      params.guestUserId,
    );
    if (byUser !== null) {
      throw new HarborRegistrationDuplicateError();
    }
  }

  const phone = params.body.contact.phone?.trim() ?? "";
  const notes = params.body.notes?.trim() ?? "";

  return params.bookingPort.createPendingBooking({
    tenantId: params.tenantId,
    guestUserId: params.guestUserId,
    tourId: params.body.tourId,
    tourTitle: card.title,
    guestLabel: params.body.contact.fullName.trim(),
    guestEmail: email,
    ...(phone.length > 0 ? { guestPhone: phone } : {}),
    partySize: params.body.partySize,
    departureAt,
    registrationIntake: {
      ...(notes.length > 0 ? { notes } : {}),
      ...(capacity !== null ? { tourCapacityMax: capacity } : {}),
    },
  });
}
