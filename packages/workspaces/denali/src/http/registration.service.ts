import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { validateDenaliRegistrationPayload } from "../denali.plugin";
import { isDenaliTourPublished } from "../catalog/denali-publish-status";
import { toDenaliCatalogCard } from "../catalog/denali-catalog-card";

import { DenaliRegistrationDuplicateError } from "./errors/denali-registration-conflict.error";
import { DenaliWorkspaceRequiredError } from "./errors/denali-workspace-required.error";
import type { BookingPublicPort } from "./ports/public-booking.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";
import type { DenaliRegistrationPostBody } from "./schemas/denali-registration-post.schema";
import { normalizeDenaliRegistrationTransportIntake } from "./resolve-denali-registration-transport";

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

export type DenaliGuestMembershipSnapshot = {
  readonly nationalId?: string | null;
  readonly fatherName?: string | null;
  readonly birthDate?: string | null;
};

export type DenaliGuestProfilePatch = {
  readonly nationalId?: string;
  readonly fatherName?: string;
  readonly birthDate?: string;
};

const PUBLIC_CATALOG_GUEST_USER_ID = "00000000-0000-4000-0000-000000000001";

export async function createDenaliRegistration(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly guestUserId: string;
  readonly body: DenaliRegistrationPostBody;
  readonly store: DenaliTourStorePort;
  readonly bookingPort: BookingPublicPort;
  readonly resolveGuestMembership?: (
    tenantId: string,
    userId: string
  ) => Promise<DenaliGuestMembershipSnapshot | null>;
  readonly saveGuestProfileFields?: (
    tenantId: string,
    userId: string,
    patch: DenaliGuestProfilePatch
  ) => Promise<void>;
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
  const card = toDenaliCatalogCard(tour);
  const guestMembership =
    params.resolveGuestMembership === undefined
      ? null
      : await params.resolveGuestMembership(params.tenantId, params.guestUserId);
  const profileNationalId = guestMembership?.nationalId?.trim() ?? "";
  const profileFatherName = guestMembership?.fatherName?.trim() ?? "";
  const profileBirthDate = guestMembership?.birthDate?.trim() ?? "";
  const registrantTarget = params.body.registrantTarget ?? "self";

  validateDenaliRegistrationPayload(
    {
      registrantTarget,
      contact: params.body.contact,
      partySize: params.body.partySize,
      transport: params.body.transport,
    },
    {
      capacity,
      nationalIdRequired: card.nationalIdRequired === true,
      fatherNameRequired: card.fatherNameRequired === true,
      birthDateRequired: card.birthDateRequired === true,
      profileNationalId: profileNationalId.length > 0 ? profileNationalId : null,
      profileFatherName: profileFatherName.length > 0 ? profileFatherName : null,
      profileBirthDate: profileBirthDate.length > 0 ? profileBirthDate : null,
    }
  );

  const normalizedTransport = normalizeDenaliRegistrationTransportIntake(
    params.body.transport,
    { transport: card.transport }
  );

  const email = params.body.contact.email?.trim() ?? "";
  const guestLabel = params.body.contact.fullName.trim();
  const intakeNationalId = params.body.contact.nationalId?.trim() ?? "";

  let duplicate: { readonly id: string } | null = null;
  if (registrantTarget === "other") {
    if (intakeNationalId.length > 0) {
      duplicate = await params.bookingPort.findDuplicateByTourGuestNationalId(
        params.tenantId,
        params.body.tourId,
        intakeNationalId
      );
    }
    if (duplicate === null) {
      duplicate = await params.bookingPort.findDuplicateByTourGuestLabel(
        params.tenantId,
        params.body.tourId,
        guestLabel
      );
    }
  } else if (params.guestUserId !== PUBLIC_CATALOG_GUEST_USER_ID) {
    duplicate = await params.bookingPort.findDuplicateByTourGuest(
      params.tenantId,
      params.body.tourId,
      params.guestUserId
    );
  } else if (email.length > 0) {
    duplicate = await params.bookingPort.findDuplicateByTourEmail(
      params.tenantId,
      params.body.tourId,
      email
    );
  }
  if (duplicate !== null) {
    throw new DenaliRegistrationDuplicateError();
  }

  const departureAt = card.departureAt?.trim();
  if (departureAt === undefined || departureAt.length === 0) {
    const err = new Error("ZOD_VALIDATION_FAILED");
    (err as Error & { details?: unknown }).details = { tourId: ["TOUR_DEPARTURE_NOT_SET"] };
    throw err;
  }

  if (
    registrantTarget === "self" &&
    params.saveGuestProfileFields !== undefined
  ) {
    const intakeNationalId = params.body.contact.nationalId?.trim() ?? "";
    const intakeFatherName = params.body.contact.fatherName?.trim() ?? "";
    const intakeBirthDate = params.body.contact.birthDate?.trim() ?? "";
    const profilePatch: DenaliGuestProfilePatch = {
      ...(card.nationalIdRequired === true &&
      profileNationalId.length === 0 &&
      intakeNationalId.length > 0
        ? { nationalId: intakeNationalId }
        : {}),
      ...(card.fatherNameRequired === true &&
      profileFatherName.length === 0 &&
      intakeFatherName.length > 0
        ? { fatherName: intakeFatherName }
        : {}),
      ...(card.birthDateRequired === true &&
      profileBirthDate.length === 0 &&
      intakeBirthDate.length > 0
        ? { birthDate: intakeBirthDate }
        : {}),
    };
    if (Object.keys(profilePatch).length > 0) {
      await params.saveGuestProfileFields(params.tenantId, params.guestUserId, profilePatch);
    }
  }

  return params.bookingPort.createPendingBooking({
    tenantId: params.tenantId,
    guestUserId: params.guestUserId,
    tourId: params.body.tourId,
    tourTitle: card.title,
    guestLabel: params.body.contact.fullName,
    ...(email.length > 0 ? { guestEmail: email } : {}),
    ...(params.body.contact.phone !== undefined ? { guestPhone: params.body.contact.phone } : {}),
    partySize: params.body.partySize,
    departureAt,
    registrationIntake: {
      registrantTarget,
      transport: normalizedTransport,
      ...(intakeNationalId.length > 0 ? { nationalId: intakeNationalId } : {}),
      // Booking-owned capacity: Denali supplies tour max when known; Booking fails closed if missing.
      ...(capacity !== null ? { tourCapacityMax: capacity } : {}),
    },
  });
}
