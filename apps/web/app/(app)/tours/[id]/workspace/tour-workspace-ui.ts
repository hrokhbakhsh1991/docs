import type { TourLifecycleStatus } from "@repo/types";

import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";

const readOnlyCopy = TOUR_WORKSPACE_COPY.readOnly;

export function isTourReadOnlyForWorkspace(status: TourLifecycleStatus): boolean {
  return status === "DRAFT" || status === "CLOSED" || status === "CANCELLED";
}

export function workspaceReadOnlyBannerText(status: TourLifecycleStatus): string {
  if (status === "CANCELLED") {
    return readOnlyCopy.cancelled;
  }
  if (status === "DRAFT") {
    return readOnlyCopy.draft;
  }
  return readOnlyCopy.closed;
}
