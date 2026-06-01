/**
 * Denali wizard → create-tour API (compat re-exports).
 *
 * Submit authority: {@link ./buildDenaliCreateTourPayloadProjection.ts}
 */

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import {
  denaliTourKindToApiTourType,
  mapDenaliCreateTourPayloadProjectionToDto,
  mapDenaliWizardFormToSubmitDto,
  splitIsoDateTime,
} from "./buildDenaliCreateTourPayloadProjection";

export {
  denaliTourKindToApiTourType,
  mapDenaliCreateTourPayloadProjectionToDto,
  mapDenaliWizardFormToSubmitDto,
  splitIsoDateTime,
};

/** Maps Denali wizard form → {@link CreateTourDto} via canonical submit projection pipeline. */
export function mapDenaliWizardToCreateTourPayload(form: DenaliCreateTourWizardForm) {
  return mapDenaliWizardFormToSubmitDto(form);
}
