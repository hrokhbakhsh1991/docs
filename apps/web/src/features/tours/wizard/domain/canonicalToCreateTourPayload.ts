/**
 * @deprecated Use {@link ./buildDenaliCreateTourPayloadProjection.ts} + {@link ./mapDenaliWizardToCreateTourPayload.ts}.
 * Utilities retained for imports; canonical→DTO mapping is no longer defined here.
 */

export {
  buildDenaliCreateTourPayloadProjection,
  denaliTourKindToApiTourType,
  splitIsoDateTime,
  type BuildDenaliCreateTourPayloadProjectionOptions,
  type DenaliCreateTourPayloadProjection,
} from "./buildDenaliCreateTourPayloadProjection";

export {
  mapDenaliCreateTourPayloadProjectionToDto,
  mapDenaliWizardToCreateTourPayload,
} from "./mapDenaliWizardToCreateTourPayload";
