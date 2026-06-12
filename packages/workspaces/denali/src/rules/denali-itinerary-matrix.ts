import { denaliRuleSet } from "./generated/denaliRuleSet.generated";
import type { DenaliRuleModelCategory, DenaliRuleModelDuration } from "./denaliRuleModel.types";

export type DenaliItineraryMatrixState = {
  readonly hidden: boolean;
  readonly required: boolean;
};

/** Matrix visibility/required flags for `program.itinerary` (product contract). */
export function readDenaliItineraryMatrixState(
  category: DenaliRuleModelCategory,
  duration: DenaliRuleModelDuration
): DenaliItineraryMatrixState | null {
  const model = denaliRuleSet[category]?.[duration] ?? null;
  if (model == null) {
    return null;
  }
  const field = model.fields.find((entry) => entry.path === "program.itinerary");
  if (field == null) {
    return null;
  }
  return Object.freeze({
    hidden: field.hidden,
    required: field.required,
  });
}
