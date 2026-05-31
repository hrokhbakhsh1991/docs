import type { QueryClient } from "@tanstack/react-query";

import { registrationKeys, tourKeys } from "@/lib/query-keys";

export function invalidateWorkspaceQueries(
  qc: QueryClient,
  tenantId: string,
  tourId: string
): void {
  void qc.invalidateQueries({
    queryKey: registrationKeys.tourRegistrations(tenantId, tourId),
  });
  void qc.invalidateQueries({ queryKey: registrationKeys.tourWaitlist(tenantId, tourId) });
  void qc.invalidateQueries({ queryKey: tourKeys.detail(tenantId, tourId) });
}
