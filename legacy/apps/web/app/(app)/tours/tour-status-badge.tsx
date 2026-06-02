"use client";

import type { TourLifecycleStatus } from "@repo/types";
import type { BadgeVariant } from "@tour/ui";
import { Badge } from "@tour/ui";
import { useTranslations } from "next-intl";

import { apiLifecycleToFormStatus } from "@/components/tours/tour-lifecycle";

import type { TourUiLifecycleStatus } from "./tour-display-types";

function statusVariant(status: TourUiLifecycleStatus): BadgeVariant {
  switch (status) {
    case "active":
      return "success";
    case "archived":
      return "info";
    default:
      return "neutral";
  }
}

export type TourStatusBadgeProps =
  | { lifecycleStatus: TourLifecycleStatus; status?: never }
  | { status: TourUiLifecycleStatus; lifecycleStatus?: never };

/** Prefer `lifecycleStatus` (API); `status` is for narrow cases that already hold a UI bucket. */
export function TourStatusBadge(props: TourStatusBadgeProps) {
  const tStatus = useTranslations("tours.status");
  const ui =
    props.lifecycleStatus != null
      ? apiLifecycleToFormStatus(props.lifecycleStatus)
      : props.status;
  return <Badge variant={statusVariant(ui)}>{tStatus(ui)}</Badge>;
}
