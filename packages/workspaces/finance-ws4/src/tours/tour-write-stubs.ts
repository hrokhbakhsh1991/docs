/**
 * Minimal tour-write stubs — required by codegen when workspaceFinance.supported.
 * Finance-ws4 is not a production tour workspace; these are identity/no-op hooks.
 */

export const FINANCE_WS4_TOUR_PUBLISH_FIELDS_OWNER_SURFACE =
  "finance-ws4.tour.publish_fields" as const;

export function mergeFinanceWs4CanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined
): T {
  if (patch === undefined) {
    return existing;
  }
  return { ...existing, ...patch };
}

export function financeWs4TourPatchRequiresOwner(_body: unknown): boolean {
  return false;
}
