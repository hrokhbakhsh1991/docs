/**
 * Denali wizard → draft persistence payload (1:1 mapper only).
 *
 * Business rules: {@link ./buildDenaliCreateTourPayloadProjection.ts}
 * (`buildDenaliWizardDraftPayloadProjection` — same canonical engine as create-tour).
 */

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { buildDenaliWizardDraftPayloadProjection } from "./buildDenaliCreateTourPayloadProjection";

/** Persisted draft body: unified canonical model (not RHF roots, not API DTO). */
export type DenaliWizardDraftPayload = {
  canonical: DenaliCanonicalTourModel;
};

/** 1:1 copy from resolved projection → draft payload (no business rules). */
export function mapDenaliWizardDraftPayloadProjectionToPayload(
  canonical: DenaliCanonicalTourModel,
): DenaliWizardDraftPayload {
  return { canonical };
}

/**
 * Maps Denali wizard form → draft payload via the same canonical projection as
 * {@link mapDenaliWizardToCreateTourPayload} (format-only difference at the boundary).
 */
export function mapDenaliWizardToDraftPayload(
  form: DenaliCreateTourWizardForm,
): DenaliWizardDraftPayload {
  return mapDenaliWizardDraftPayloadProjectionToPayload(
    buildDenaliWizardDraftPayloadProjection(form),
  );
}
