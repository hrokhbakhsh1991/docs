/**
 * Minimal tour-write stubs — required by codegen when workspaceFinance.supported.
 */

export const FINANCE_WS6_TOUR_PUBLISH_FIELDS_OWNER_SURFACE =
  "finance-ws6.tour.publish_fields" as const;

export function mergeFinanceWs6CanonicalPatchData<T extends Record<string, unknown>>(
  existing: T,
  patch: Record<string, unknown> | undefined
): T {
  if (patch === undefined) {
    return existing;
  }
  return { ...existing, ...patch };
}

export function financeWs6TourPatchRequiresOwner(_body: unknown): boolean {
  return false;
}
