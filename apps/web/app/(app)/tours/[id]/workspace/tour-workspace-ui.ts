import type { TourLifecycleStatus } from "@repo/types";

export function isTourReadOnlyForWorkspace(status: TourLifecycleStatus): boolean {
  return status === "DRAFT" || status === "CLOSED" || status === "CANCELLED";
}

export function workspaceReadOnlyBannerText(status: TourLifecycleStatus): string {
  if (status === "CANCELLED") {
    return "This tour is cancelled and its registrations are read-only.";
  }
  if (status === "DRAFT") {
    return "This tour is a draft; registrations are read-only until the tour is open.";
  }
  return "This tour is closed and its registrations are read-only.";
}
