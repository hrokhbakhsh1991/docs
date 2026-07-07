export const LEGACY_FIELD_CANDIDATE_USAGE_DETECTED = "LEGACY_FIELD_CANDIDATE_USAGE_DETECTED";

/**
 * Pass 3: `deliveryCandidateFieldIds` was removed from the field policy manifest contract.
 * Delivery field catalogs and runtime candidates are sourced from `WorkspaceFieldRegistry` only.
 */
export function assertNoLegacyDeliveryCandidateFieldIds(manifest: unknown, context: string): void {
  if (
    typeof manifest === "object" &&
    manifest !== null &&
    "deliveryCandidateFieldIds" in manifest &&
    (manifest as { deliveryCandidateFieldIds?: unknown }).deliveryCandidateFieldIds != null
  ) {
    throw new Error(`${LEGACY_FIELD_CANDIDATE_USAGE_DETECTED}:${context}`);
  }
}
