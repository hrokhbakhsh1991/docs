import {
  assertWorkspaceTypeOrThrow,
  requireWorkspacePublishedTour,
} from "@app-tour/workspace-sdk";

import { DENALI_WORKSPACE_TYPE } from "../denali-identity";
import { isDenaliTourPublished } from "../catalog/denali-publish-status";
import { toDenaliCatalogCard } from "../catalog/denali-catalog-card";
import { DenaliRegistrationInvalidError } from "./errors/denali-registration-invalid.error";
import { DenaliRegistrationNotAmendableError } from "./errors/denali-registration-not-amendable.error";
import { DenaliRegistrationNotFoundError } from "./errors/denali-registration-not-found.error";
import { DenaliWorkspaceRequiredError } from "./errors/denali-workspace-required.error";
import type { BookingPublicPort } from "./ports/public-booking.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";
import { normalizeDenaliRegistrationTransportIntake } from "./resolve-denali-registration-transport";
import type { DenaliRegistrationTransportIntake } from "./schemas/denali-registration-transport.schema";
import { denaliRegistrationTransportIntakeSchema } from "./schemas/denali-registration-transport.schema";

const AMENDABLE_STATUSES = new Set(["pending", "waitlisted"]);

export type DenaliRegistrationAmendBody = {
  readonly transport?: unknown;
};

/**
 * Member amend of allowlisted intake (transport only) before club approval.
 * Never merges finance keys (obligationOverride / tourCapacityMax).
 */
export async function amendDenaliRegistrationIntake(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly guestUserId: string;
  readonly registrationId: string;
  readonly body: DenaliRegistrationAmendBody;
  readonly store: DenaliTourStorePort;
  readonly bookingPort: BookingPublicPort;
}): Promise<{ readonly id: string; readonly status: string }> {
  assertWorkspaceTypeOrThrow(
    params.workspaceType,
    DENALI_WORKSPACE_TYPE,
    () => new DenaliWorkspaceRequiredError(),
  );

  const owned = await params.bookingPort.findOwnedBooking(
    params.tenantId,
    params.registrationId,
    params.guestUserId
  );
  if (owned === null) {
    throw new DenaliRegistrationNotFoundError();
  }
  if (!AMENDABLE_STATUSES.has(owned.status)) {
    throw new DenaliRegistrationNotAmendableError();
  }

  if (params.body.transport === undefined) {
    throw new DenaliRegistrationInvalidError();
  }
  const parsedTransport = denaliRegistrationTransportIntakeSchema.safeParse(params.body.transport);
  if (!parsedTransport.success) {
    throw new DenaliRegistrationInvalidError();
  }

  const tour = await requireWorkspacePublishedTour({
    findFirst: () =>
      params.store.findFirst({
        tenantId: params.tenantId,
        id: owned.tourId,
      }),
    isPublished: isDenaliTourPublished,
    getCanonical: (row) => row.canonical,
  });
  const card = toDenaliCatalogCard(tour);

  let normalizedTransport: DenaliRegistrationTransportIntake;
  try {
    normalizedTransport = normalizeDenaliRegistrationTransportIntake(parsedTransport.data, {
      transport: card.transport,
    });
  } catch {
    throw new DenaliRegistrationInvalidError();
  }

  const updated = await params.bookingPort.mergeOwnedRegistrationIntake({
    tenantId: params.tenantId,
    bookingId: params.registrationId,
    guestUserId: params.guestUserId,
    patch: { transport: normalizedTransport },
  });
  if (updated === null) {
    throw new DenaliRegistrationNotFoundError();
  }
  return { id: updated.id, status: updated.status };
}
