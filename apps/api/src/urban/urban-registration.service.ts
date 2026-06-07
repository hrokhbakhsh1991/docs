import { validateUrbanRegistrationPayload } from "@app-tour/workspace-urban";

import type { TourStorageRepository } from "../db/tour.repository";
import { isUrbanTourPublished } from "./urban-publish-status";
import {
  getUrbanRegistrationRepository,
  type UrbanRegistrationRepository,
} from "./in-memory-urban-registration.repository";
import { UrbanRegistrationDuplicateError } from "./urban-registration-conflict.error";
import type { UrbanRegistrationPostBody } from "./schemas/urban-registration-post.schema";
import { UrbanWorkspaceRequiredError } from "./urban-workspace-required.error";

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
  readonly store: TourStorageRepository;
  readonly registrationRepo?: UrbanRegistrationRepository;
}): Promise<{ readonly id: string; readonly status: string }> {
  if (params.workspaceType !== "urban") {
    throw new UrbanWorkspaceRequiredError();
  }

  const tour = await params.store.getById(params.body.tourId, params.tenantId);
  if (tour === null || !isUrbanTourPublished(tour.canonical)) {
    const err = new Error("ZOD_VALIDATION_FAILED");
    (err as Error & { details?: unknown }).details = { tourId: ["TOUR_NOT_PUBLISHED"] };
    throw err;
  }

  const capacity = tourCapacity(tour.canonical as { data: Record<string, unknown> });
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

  const created = await repo.create({
    tenantId: params.tenantId,
    tourId: params.body.tourId,
    email: params.body.contact.email,
    fullName: params.body.contact.fullName,
    phone: params.body.contact.phone,
    partySize: params.body.partySize,
    notes: params.body.notes,
  });

  return { id: created.id, status: created.status };
}
