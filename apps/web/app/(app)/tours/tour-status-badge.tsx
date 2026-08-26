"use client";

import { useTranslations } from "next-intl";

import { OperatorStatusBadge } from "@/admin/patterns/operator-status-badge";
import type { TourUiStatus } from "@/features/tours/operator-tours-types";

const VARIANT: Record<TourUiStatus, "secondary" | "success" | "outline"> = {
  draft: "secondary",
  active: "success",
  archived: "outline",
};

type TourStatusBadgeProps = {
  readonly status: TourUiStatus;
};

export function TourStatusBadge({ status }: TourStatusBadgeProps) {
  const t = useTranslations("tours.status");

  return (
    <OperatorStatusBadge variant={VARIANT[status]} data-tour-status={status}>
      {t(status)}
    </OperatorStatusBadge>
  );
}
