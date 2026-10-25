/** Host composition for optional workspace-owned post-capacity waitlist policies. */
import { resolveDenaliRegistrationApprovalMode } from "@app-tour/workspace-denali/booking";

import { promoteAvailableWaitlistedGuests } from "./bookings/promote-waitlist-after-seat-release.ts";
import { createTourStorageRepository } from "./storage/create-tour-storage.ts";

async function reconcileDenaliWaitlistAfterCapacityChange(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly reason: "capacity_released" | "capacity_increased";
}): Promise<readonly string[]> {
  if (input.reason === "capacity_increased") {
    const tour = await createTourStorageRepository().getById(input.tourId, input.tenantId);
    if (resolveDenaliRegistrationApprovalMode(tour?.canonical) !== "auto") {
      return [];
    }
  }
  return promoteAvailableWaitlistedGuests(input);
}

export function resolveWorkspaceBookingWaitlistPromotion(workspaceType: string) {
  if (workspaceType.trim().toLowerCase() !== "denali") {
    return undefined;
  }
  return { afterCapacityChange: reconcileDenaliWaitlistAfterCapacityChange };
}
