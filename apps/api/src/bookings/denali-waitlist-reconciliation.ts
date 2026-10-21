import { resolveDenaliRegistrationApprovalMode } from "@app-tour/workspace-denali/booking";

import { createTourStorageRepository } from "../storage/create-tour-storage.ts";
import { promoteAvailableWaitlistedGuests } from "./promote-waitlist-after-seat-release.ts";

/** Reconcile only auto-approved Denali tours; manual screening remains operator-owned. */
export async function reconcileDenaliWaitlistAfterCapacityChange(input: {
  readonly tenantId: string;
  readonly tourId: string;
}): Promise<readonly string[]> {
  const tour = await createTourStorageRepository().getById(input.tourId, input.tenantId);
  if (resolveDenaliRegistrationApprovalMode(tour?.canonical) !== "auto") {
    return [];
  }
  return promoteAvailableWaitlistedGuests(input);
}
