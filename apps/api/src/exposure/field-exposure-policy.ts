/**
 * Phase 8f — exposure restriction layer between Profile/Intent and FieldPolicy eligibility.
 *
 * FieldExposurePolicy narrows candidate ids to the workspace exposure catalog. FieldPolicy then
 * evaluates visibility/state rules for the integration surface.
 */
export function restrictFieldExposureCandidates(input: {
  readonly allowedCatalogFieldIds: readonly string[];
  readonly candidateFieldIds: readonly string[];
}): readonly string[] {
  if (input.candidateFieldIds.length === 0) {
    return [];
  }
  const allowed = new Set(input.allowedCatalogFieldIds);
  return input.candidateFieldIds.filter((fieldId) => allowed.has(fieldId));
}
