import type { BadgeVariant } from "@tour/ui";

import type { TourUiLifecycleStatus } from "../tour-display-types";

export function lifecycleBadgeVariant(status: TourUiLifecycleStatus): BadgeVariant {
  switch (status) {
    case "active":
      return "success";
    case "archived":
      return "info";
    default:
      return "neutral";
  }
}
