/**
 * Minimal tour-write stubs — required by codegen when workspaceFinance.supported
 * (manifest must declare tourWrite.workspaceTypeExport + merge/publish surface).
 * Finance-ws3 is not a production tour workspace; these are identity/no-op hooks.
 */

export const FINANCE_WS3_TOUR_PUBLISH_FIELDS_OWNER_SURFACE =
  "finance-ws3.tour.publish_fields" as const;

export function mergeFinanceWs3CanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined
): T {
  if (patch === undefined) {
    return existing;
  }
  return { ...existing, ...patch };
}

/** No owner-only publish fields for this finance fixture. */
export function financeWs3TourPatchRequiresOwner(_body: unknown): boolean {
  return false;
}
