import {
  denaliTourPatchTouchesPublishFields,
  type DenaliTourPatchBody,
} from "./tour-publish-field-gate";

export { denaliTourPatchTouchesPublishFields, type DenaliTourPatchBody };

/** CASL surface id for owner-only Denali tour publish-field PATCH (Phase 12.3). */
export const DENALI_TOUR_PUBLISH_FIELDS_OWNER_SURFACE = "denali.tour.publish_fields" as const;

export function denaliTourPatchRequiresOwner(body: DenaliTourPatchBody): boolean {
  return denaliTourPatchTouchesPublishFields(body);
}
