import { validateUrbanRegistrationPayload } from "../urban.plugin";

import { UrbanRegistrationDuplicateError } from "./errors/urban-registration-conflict.error";
import { UrbanRegistrationClosedError } from "./errors/urban-registration-closed.error";
import { UrbanWorkspaceRequiredError } from "./errors/urban-workspace-required.error";
import { getUrbanHttpHost } from "./host-runtime";
import { isUrbanTourPublished } from "./publish-status";
import type { UrbanTourStorePort } from "./ports/tour-store.port";
import {
  getUrbanRegistrationRepository,
  type UrbanRegistrationRepository,
} from "./registration.repository";
import type { UrbanRegistrationPostBody } from "./schemas/urban-registration-post.schema";

function tourCapacity(canonical: { readonly data: Record<string, unknown> }): number | null {
  const tour = canonical.data.tour;
  if (tour === null || typeof tour !== "object" || Array.isArray(tour)) {
    return null;
  }
  const capacity = (tour as Record<string, unknown>).capacity;
  return typeof capacity === "number" && Number.isFinite(capacity) ? capacity : null;
}

export async function createUrbanRegistration(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly body: UrbanRegistrationPostBody;
  readonly store: UrbanTourStorePort;
  readonly registrationRepo?: UrbanRegistrationRepository;
  readonly registrationPolicy?: "open" | "waitlist" | "closed";
}): Promise<{ readonly id: string; readonly status: string }> {
  if (params.workspaceType !== "urban") {
    throw new UrbanWorkspaceRequiredError();
  }

  const policy = params.registrationPolicy ?? "open";
  if (policy === "closed") {
    throw new UrbanRegistrationClosedError();
  }

  const tour = await params.store.findFirst({
    tenantId: params.tenantId,
    id: params.body.tourId,
  });
  if (tour === null || !isUrbanTourPublished(tour.canonical)) {
    const err = new Error("ZOD_VALIDATION_FAILED");
    (err as Error & { details?: unknown }).details = { tourId: ["TOUR_NOT_PUBLISHED"] };
    throw err;
  }

  const capacity = tourCapacity(tour.canonical);
  validateUrbanRegistrationPayload(
    {
      contact: params.body.contact,
      partySize: params.body.partySize,
      notes: params.body.notes,
    },
    { capacity }
  );

  const repo = params.registrationRepo ?? getUrbanRegistrationRepository();
  const existing = await repo.findByTenantTourEmail(
    params.tenantId,
    params.body.tourId,
    params.body.contact.email
  );
  if (existing !== null) {
    throw new UrbanRegistrationDuplicateError();
  }

  const partySize = params.body.partySize ?? 1;
  const acceptedSeats = await repo.sumAcceptedPartySize(params.tenantId, params.body.tourId);
  const host = getUrbanHttpHost();
  const registrationStatus = host.registration.decideRegistrationStatus({
    tourCapacity: capacity,
    acceptedSeats,
    requestedPartySize: partySize,
    policy,
  });

  const created = await repo.create({
    tenantId: params.tenantId,
    tourId: params.body.tourId,
    email: params.body.contact.email,
    fullName: params.body.contact.fullName,
    phone: params.body.contact.phone,
    partySize: params.body.partySize,
    notes: params.body.notes,
    status: registrationStatus,
  });

  return { id: created.id, status: created.status };
}
