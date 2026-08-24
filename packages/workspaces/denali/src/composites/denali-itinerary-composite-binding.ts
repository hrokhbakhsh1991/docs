import type { WorkspaceItineraryWizardCompositeBinding } from "@app-tour/workspace-sdk";

import { DENALI_ITINERARY_CANONICAL_PATH } from "../field-registry/denali-itinerary-tour-field-module";

/** CW7-10 — manifest `workspaceItinerary.wizardComposite` binding for denali.itinerary. */
export const denaliItineraryWizardCompositeBinding: WorkspaceItineraryWizardCompositeBinding =
  Object.freeze({
    compositeId: "denali.itinerary",
    anchorCanonicalPath: DENALI_ITINERARY_CANONICAL_PATH,
  });
