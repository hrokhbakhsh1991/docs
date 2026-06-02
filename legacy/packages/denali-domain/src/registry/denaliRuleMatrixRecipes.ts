/**
 * Which {@link DenaliMatrixTag} bundles are active per category × duration.
 * Edit tags on fields in {@link ./denaliFieldRegistryData.ts}; edit cell recipes here.
 */

import type { DenaliRuleModelCategory, DenaliRuleModelDuration } from "../rules/denaliRuleModel.types";

export type DenaliMatrixCell = `${DenaliRuleModelCategory}:${DenaliRuleModelDuration}`;

export type DenaliMatrixTag =
  | "core"
  | "optional_basic"
  | "destination"
  | "event_variant"
  | "end_datetime_hidden"
  | "end_datetime_required"
  | "outdoor_program"
  | "event_program_hidden"
  | "altitude_mountain"
  | "altitude_hidden"
  | "itinerary_hidden"
  | "itinerary_visible"
  | "optional_program"
  | "transport_notes"
  | "policies_pricing"
  | "outdoor_logistics_location"
  | "event_logistics_hidden"
  | "gear"
  | "mountain_participants"
  | "non_mountain_participants_hidden";

/** `null` = matrix not defined (e.g. event multi_day). */
export const DENALI_MATRIX_CELL_TAGS: Record<DenaliMatrixCell, readonly DenaliMatrixTag[] | null> = {
  "mountain:single_day": [
    "core",
    "optional_basic",
    "destination",
    "end_datetime_hidden",
    "outdoor_program",
    "altitude_mountain",
    "itinerary_hidden",
    "optional_program",
    "transport_notes",
    "policies_pricing",
    "outdoor_logistics_location",
    "gear",
    "mountain_participants",
  ],
  "mountain:multi_day": [
    "core",
    "optional_basic",
    "destination",
    "end_datetime_required",
    "outdoor_program",
    "altitude_mountain",
    "itinerary_visible",
    "optional_program",
    "transport_notes",
    "policies_pricing",
    "outdoor_logistics_location",
    "gear",
    "mountain_participants",
  ],
  "nature:single_day": [
    "core",
    "optional_basic",
    "destination",
    "end_datetime_hidden",
    "outdoor_program",
    "altitude_hidden",
    "itinerary_hidden",
    "optional_program",
    "transport_notes",
    "policies_pricing",
    "outdoor_logistics_location",
    "gear",
    "non_mountain_participants_hidden",
  ],
  "nature:multi_day": [
    "core",
    "optional_basic",
    "destination",
    "end_datetime_required",
    "outdoor_program",
    "altitude_hidden",
    "itinerary_visible",
    "optional_program",
    "transport_notes",
    "policies_pricing",
    "outdoor_logistics_location",
    "gear",
    "non_mountain_participants_hidden",
  ],
  "desert:single_day": [
    "core",
    "optional_basic",
    "destination",
    "end_datetime_hidden",
    "outdoor_program",
    "altitude_hidden",
    "itinerary_hidden",
    "optional_program",
    "transport_notes",
    "policies_pricing",
    "outdoor_logistics_location",
    "gear",
    "non_mountain_participants_hidden",
  ],
  "desert:multi_day": [
    "core",
    "optional_basic",
    "destination",
    "end_datetime_required",
    "outdoor_program",
    "altitude_hidden",
    "itinerary_visible",
    "optional_program",
    "transport_notes",
    "policies_pricing",
    "outdoor_logistics_location",
    "gear",
    "non_mountain_participants_hidden",
  ],
  "event:single_day": [
    "core",
    "optional_basic",
    "event_variant",
    "destination",
    "end_datetime_hidden",
    "event_program_hidden",
    "altitude_hidden",
    "itinerary_hidden",
    "optional_program",
    "transport_notes",
    "policies_pricing",
    "event_logistics_hidden",
    "gear",
    "non_mountain_participants_hidden",
  ],
  "event:multi_day": null,
};

export const DENALI_MATRIX_CELLS = Object.keys(DENALI_MATRIX_CELL_TAGS) as DenaliMatrixCell[];
