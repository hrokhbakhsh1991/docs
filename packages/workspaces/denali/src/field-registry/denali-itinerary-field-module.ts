import type { WorkspaceItineraryFieldRegistryFragment } from "@app-tour/workspace-sdk";

import { denaliRegistryPresentationFields } from "./denali-integration-field-presentation";
import {
  DENALI_ITINERARY_CANONICAL_PATH,
  denaliItineraryFieldModule,
} from "./denali-itinerary-tour-field-module";

const itineraryTourField = denaliItineraryFieldModule.fields[0];

/**
 * CW7-10 — workspace field-registry slice bound via manifest `fieldModule`.
 */
export const denaliItineraryFieldRegistryFragment: WorkspaceItineraryFieldRegistryFragment =
  Object.freeze({
    version: 1,
    fields: Object.freeze([
      Object.freeze({
        id: "denali.itinerary",
        canonicalPath: DENALI_ITINERARY_CANONICAL_PATH,
        stepId: itineraryTourField.stepId,
        kind: "composite" as const,
        required: itineraryTourField.ruleDefaults.required,
        tags: itineraryTourField.tags,
        ...denaliRegistryPresentationFields({
          id: "denali.itinerary",
          canonicalPath: DENALI_ITINERARY_CANONICAL_PATH,
          tags: itineraryTourField.tags,
        }),
      }),
    ]),
  });

export {
  DENALI_ITINERARY_CANONICAL_PATH,
  denaliItineraryFieldModule,
} from "./denali-itinerary-tour-field-module";
