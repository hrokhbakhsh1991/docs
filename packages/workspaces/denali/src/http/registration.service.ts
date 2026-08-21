import {
  assertWorkspaceTypeOrThrow,
  createTourDepartureNotSetValidationError,
  readWorkspaceCanonicalCapacityByPath,
  requireWorkspacePublishedTour,
  WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID,
} from "@app-tour/workspace-sdk";

import {
  assertDenaliCreateValid,
  buildDenaliBookingCreatePolicyContext,
  denaliGuestQualifiesForRecentTourBypass,
  resolveDenaliRegistrationApprovalMode,
} from "../booking";
import { DENALI_WORKSPACE_TYPE } from "../denali-identity";

import {
  resolveDenaliRegistrationContactPhone,
  validateDenaliRegistrationPayload,
} from "./registration.validation";
import { isDenaliTourPublished } from "../catalog/denali-publish-status";
import { toDenaliCatalogCard } from "../catalog/denali-catalog-card";

import { DenaliRegistrationDuplicateError } from "./errors/denali-registration-conflict.error";
import { DenaliWorkspaceRequiredError } from "./errors/denali-workspace-required.error";
import type { BookingPublicPort } from "./ports/public-booking.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";
import type { DenaliRegistrationPostBody } from "./schemas/denali-registration-post.schema";
import { normalizeDenaliRegistrationTransportIntake } from "./resolve-denali-registration-transport";

export type DenaliGuestMembershipSnapshot = {
  readonly displayName?: string | null;
  readonly nationalId?: string | null;
  readonly fatherName?: string | null;
  readonly birthDate?: string | null;
};

export type DenaliGuestProfilePatch = {
  readonly displayName?: string;
  readonly nationalId?: string;
  readonly fatherName?: string;
  readonly birthDate?: string;
};

const PUBLIC_CATALOG_GUEST_USER_ID = WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID;

async function finalizePublicRegistrationApproval(input: {
  readonly tenantId: string;
  readonly guestUserId: string;
  readonly registrantTarget: "self" | "other";
  readonly tourId: string;
  readonly tourCanonical: unknown;
  readonly store: DenaliTourStorePort;
  readonly bookingPort: BookingPublicPort;
  readonly pending: { readonly id: string; readonly status: string };
}): Promise<{ readonly id: string; readonly status: string }> {
  if (resolveDenaliRegistrationApprovalMode(input.tourCanonical) === "auto") {
    return input.bookingPort.autoApprovePublicBooking({
      tenantId: input.tenantId,
      bookingId: input.pending.id,
      actorUserId: input.guestUserId,
    });
  }

  const qualifies = await denaliGuestQualifiesForRecentTourBypass({
    tourCanonical: input.tourCanonical,
    currentTourId: input.tourId,
    guestUserId: input.guestUserId,
    registrantTarget: input.registrantTarget,
    tenantId: input.tenantId,
    store: input.store,
    bookingPort: input.bookingPort,
  });
  if (!qualifies) {
    return input.pending;
  }

  return input.bookingPort.autoApprovePublicBooking({
    tenantId: input.tenantId,
    bookingId: input.pending.id,
    actorUserId: input.guestUserId,
  });
}

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
  assertWorkspaceTypeOrThrow(
    params.workspaceType,
    DENALI_WORKSPACE_TYPE,
    () => new DenaliWorkspaceRequiredError(),
  );

  const tour = await requireWorkspacePublishedTour({
    findFirst: () =>
      params.store.findFirst({
        tenantId: params.tenantId,
        id: params.body.tourId,
      }),
    isPublished: isDenaliTourPublished,
    getCanonical: (row) => row.canonical,
  });

  const capacityRaw = readWorkspaceCanonicalCapacityByPath(tour.canonical, ["capacityMax"]);
  const capacity = capacityRaw === null ? null : Math.trunc(capacityRaw);
  const card = toDenaliCatalogCard(tour);
  const guestMembership =
    params.resolveGuestMembership === undefined
      ? null
      : await params.resolveGuestMembership(params.tenantId, params.guestUserId);
  const profileNationalId = guestMembership?.nationalId?.trim() ?? "";
  const profileFatherName = guestMembership?.fatherName?.trim() ?? "";
  const profileBirthDate = guestMembership?.birthDate?.trim() ?? "";
  const profileDisplayName = guestMembership?.displayName?.trim() ?? "";
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
  const guestPhone = resolveDenaliRegistrationContactPhone(
    registrantTarget,
    params.body.contact.phone
  );

  let duplicate: { readonly id: string } | null = null;
  if (registrantTarget === "other") {
    if (intakeNationalId.length > 0) {
      duplicate = await params.bookingPort.findDuplicateByTourGuestNationalId(
        params.tenantId,
        params.body.tourId,
        intakeNationalId
      );
    }
    if (duplicate === null && guestPhone !== undefined && guestPhone.length > 0) {
      duplicate = await params.bookingPort.findDuplicateByTourGuestPhone(
        params.tenantId,
        params.body.tourId,
        guestPhone
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
    throw createTourDepartureNotSetValidationError();
  }

  // Phase 1 booking domain — fail closed on Denali create shape before host pending create.
  // Occupancy capacity remains host-locked via booking capacityPolicy adapters.
  assertDenaliCreateValid(
    buildDenaliBookingCreatePolicyContext({
      tenantId: params.tenantId,
      tourId: params.body.tourId,
      tourTitle: card.title,
      guestLabel,
      ...(email.length > 0 ? { guestEmail: email } : {}),
      ...(guestPhone !== undefined ? { guestPhone } : {}),
      partySize: params.body.partySize,
      departureAt,
      tourCapacityMax: capacity,
    })
  );

  if (
    registrantTarget === "self" &&
    params.saveGuestProfileFields !== undefined &&
    params.guestUserId !== PUBLIC_CATALOG_GUEST_USER_ID
  ) {
    const intakeFatherName = params.body.contact.fatherName?.trim() ?? "";
    const intakeBirthDate = params.body.contact.birthDate?.trim() ?? "";
    const intakeFullName = params.body.contact.fullName.trim();
    const profilePatch: DenaliGuestProfilePatch = {
      ...(profileDisplayName.length === 0 && intakeFullName.length > 0
        ? { displayName: intakeFullName }
        : {}),
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

  const registrationIntake = {
    registrantTarget,
    transport: normalizedTransport,
    ...(intakeNationalId.length > 0 ? { nationalId: intakeNationalId } : {}),
    // Booking-owned capacity: Denali supplies tour max when known; Booking fails closed if missing.
    ...(capacity !== null ? { tourCapacityMax: capacity } : {}),
  };

  // Own-other identity collision → reclassify same row to self (tour-global guest uniques).
  if (
    registrantTarget === "self" &&
    params.guestUserId !== PUBLIC_CATALOG_GUEST_USER_ID
  ) {
    let identityHit: { readonly id: string } | null = null;
    if (intakeNationalId.length > 0) {
      identityHit = await params.bookingPort.findDuplicateByTourGuestNationalId(
        params.tenantId,
        params.body.tourId,
        intakeNationalId
      );
    }
    if (
      identityHit === null &&
      guestPhone !== undefined &&
      guestPhone.length > 0
    ) {
      identityHit = await params.bookingPort.findDuplicateByTourGuestPhone(
        params.tenantId,
        params.body.tourId,
        guestPhone
      );
    }
    if (identityHit === null) {
      identityHit = await params.bookingPort.findDuplicateByTourGuestLabel(
        params.tenantId,
        params.body.tourId,
        guestLabel
      );
    }
    if (identityHit !== null) {
      const owned = await params.bookingPort.findOwnedBooking(
        params.tenantId,
        identityHit.id,
        params.guestUserId
      );
      if (owned !== null && owned.registrantTarget === "other") {
        const reclassified = await params.bookingPort.reclassifyOwnedOtherToSelf({
          tenantId: params.tenantId,
          bookingId: owned.id,
          guestUserId: params.guestUserId,
          guestLabel,
          ...(email.length > 0 ? { guestEmail: email } : {}),
          ...(guestPhone !== undefined ? { guestPhone } : {}),
          registrationIntakePatch: registrationIntake,
        });
        if (reclassified !== null) {
          return finalizePublicRegistrationApproval({
            tenantId: params.tenantId,
            guestUserId: params.guestUserId,
            registrantTarget,
            tourId: params.body.tourId,
            tourCanonical: tour.canonical,
            store: params.store,
            bookingPort: params.bookingPort,
            pending: reclassified,
          });
        }
      }
    }
  }

  const created = await params.bookingPort.createPendingBooking({
    tenantId: params.tenantId,
    guestUserId: params.guestUserId,
    tourId: params.body.tourId,
    tourTitle: card.title,
    guestLabel: params.body.contact.fullName,
    ...(email.length > 0 ? { guestEmail: email } : {}),
    ...(guestPhone !== undefined ? { guestPhone } : {}),
    partySize: params.body.partySize,
    departureAt,
    registrationIntake,
  });

  // Phase 3.1 / 3.2 — tour SoT: pricing.registrationApproval or requiresManualAdminApproval.
  // Never trust client intake; mode + recent-tour bypass come only from loaded tour canonical.
  return finalizePublicRegistrationApproval({
    tenantId: params.tenantId,
    guestUserId: params.guestUserId,
    registrantTarget,
    tourId: params.body.tourId,
    tourCanonical: tour.canonical,
    store: params.store,
    bookingPort: params.bookingPort,
    pending: created,
  });
}
