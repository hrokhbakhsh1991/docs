import { defineWorkspaceItineraryFieldFragment } from "@app-tour/workspace-sdk";

import type { DenaliCreateWizardStepId } from "../layout/stepIds";

import type { DenaliFieldDefinition } from "./denaliFieldRegistryData";

export const DENALI_ITINERARY_CANONICAL_PATH = "program.itinerary" as const;

export const denaliItineraryTourField = Object.freeze({
  canonicalPath: DENALI_ITINERARY_CANONICAL_PATH,
  stepId: "denali_program" as DenaliCreateWizardStepId,
  rhfPath: "programNature.itinerary",
  zodPath: "programNature.itinerary",
  zodKind: "itinerary",
  tags: ["itinerary_hidden", "itinerary_visible"] as const,
  ruleDefaults: { required: false, hidden: true },
  structuralInvariant: { kind: "clearWhenNotVisible" as const },
  cellOverrides: {
    "desert:multi_day": { required: true, hidden: false },
    "mountain:multi_day": { required: true, hidden: false },
    "nature:multi_day": { required: true, hidden: false },
  },
}) satisfies DenaliFieldDefinition;

/**
 * CW7-10 — tour-field config bound via manifest `workspaceItinerary.fieldModule`.
 */
export const denaliItineraryFieldModule = defineWorkspaceItineraryFieldFragment({
  canonicalPath: denaliItineraryTourField.canonicalPath,
  stepId: denaliItineraryTourField.stepId,
  rhfPath: denaliItineraryTourField.rhfPath,
  zodPath: denaliItineraryTourField.zodPath,
  zodKind: denaliItineraryTourField.zodKind,
  tags: denaliItineraryTourField.tags,
  ruleDefaults: denaliItineraryTourField.ruleDefaults,
});

export { denaliItineraryTourField as denaliItineraryField };
