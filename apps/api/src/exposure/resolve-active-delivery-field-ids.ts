import type { FieldExposureDecision } from "./resolve-exposure-decision";

export type ActiveDeliveryFieldIds = {
  readonly fieldIds: readonly string[];
  readonly engineSelectorMissing: boolean;
};

/**
 * Resolves the active field ids that will be written to the compatibility
 * `integrationDeliveryFieldIds` payload key. The engine selector is authoritative in every runtime
 * mode.
 */
export function resolveActiveDeliveryFieldIds(input: {
  readonly fieldExposureDecision: FieldExposureDecision | undefined;
}): ActiveDeliveryFieldIds {
  const engineSelectedFieldIds = input.fieldExposureDecision?.engineSelectedFieldIds;
  if (engineSelectedFieldIds === undefined) {
    return { fieldIds: [], engineSelectorMissing: true };
  }

  return {
    fieldIds: engineSelectedFieldIds,
    engineSelectorMissing: false,
  };
}
