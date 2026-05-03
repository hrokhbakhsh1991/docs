"use client";

import type { BadgeVariant } from "@tour/ui";
import { Badge } from "@tour/ui";

import type { TourUiLifecycleStatus } from "./tour-display-types";

function statusVariant(status: TourUiLifecycleStatus): BadgeVariant {
  switch (status) {
    case "Published":
      return "success";
    case "Archived":
      return "info";
    default:
      return "neutral";
  }
}

export function TourStatusBadge({ status }: { status: TourUiLifecycleStatus }) {
  return <Badge variant={statusVariant(status)}>{status}</Badge>;
}
