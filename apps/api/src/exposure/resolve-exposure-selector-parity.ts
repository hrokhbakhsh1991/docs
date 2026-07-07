export type ExposureSelectorParityReport = {
  readonly matches: boolean;
  readonly legacyOnlyFieldIds: readonly string[];
  readonly engineOnlyFieldIds: readonly string[];
  readonly legacyFieldCount: number;
  readonly engineFieldCount: number;
  readonly mismatchCount: number;
};

function sortedUnique(fieldIds: readonly string[]): readonly string[] {
  return [...new Set(fieldIds.filter((fieldId) => fieldId.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function difference(left: readonly string[], right: ReadonlySet<string>): readonly string[] {
  return left.filter((fieldId) => !right.has(fieldId));
}

/**
 * Compares the legacy delivery selector with the engine selector after both have already been
 * computed by dispatch. This is observability only; it does not choose active delivery fields.
 */
export function resolveExposureSelectorParity(input: {
  readonly legacyEligibleFieldIds: readonly string[];
  readonly engineSelectedFieldIds: readonly string[];
}): ExposureSelectorParityReport {
  const legacyFieldIds = sortedUnique(input.legacyEligibleFieldIds);
  const engineFieldIds = sortedUnique(input.engineSelectedFieldIds);
  const legacySet = new Set(legacyFieldIds);
  const engineSet = new Set(engineFieldIds);
  const legacyOnlyFieldIds = difference(legacyFieldIds, engineSet);
  const engineOnlyFieldIds = difference(engineFieldIds, legacySet);
  const mismatchCount = legacyOnlyFieldIds.length + engineOnlyFieldIds.length;

  return {
    matches: mismatchCount === 0,
    legacyOnlyFieldIds,
    engineOnlyFieldIds,
    legacyFieldCount: legacyFieldIds.length,
    engineFieldCount: engineFieldIds.length,
    mismatchCount,
  };
}
