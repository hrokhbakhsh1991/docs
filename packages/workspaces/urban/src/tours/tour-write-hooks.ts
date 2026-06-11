import {
  urbanTourPatchTouchesPublishFields,
  type UrbanTourPatchBody,
} from "../http/tour-publish-field-gate";

export { urbanTourPatchTouchesPublishFields, type UrbanTourPatchBody };

/** CASL surface id for owner-only urban tour publish-field PATCH (Phase 8.1). */
export const URBAN_TOUR_PUBLISH_FIELDS_OWNER_SURFACE = "urban.tour.publish_fields" as const;

export function urbanTourPatchRequiresOwner(body: UrbanTourPatchBody): boolean {
  return urbanTourPatchTouchesPublishFields(body);
}
