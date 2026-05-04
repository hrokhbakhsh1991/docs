import type { QueryClient } from "@tanstack/react-query";

import { registrationKeys, tourKeys } from "@/lib/query-keys";

export function invalidateWorkspaceQueries(qc: QueryClient, tourId: string): void {
  void qc.invalidateQueries({ queryKey: registrationKeys.tourRegistrations(tourId) });
  void qc.invalidateQueries({ queryKey: registrationKeys.tourWaitlist(tourId) });
  void qc.invalidateQueries({ queryKey: tourKeys.detail(tourId) });
}
