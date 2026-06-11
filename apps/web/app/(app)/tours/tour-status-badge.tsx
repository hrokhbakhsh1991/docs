"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { TourUiStatus } from "@/features/tours/operator-tours-types";
const VARIANT: Record<TourUiStatus, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  active: "default",
  archived: "outline",
};

type TourStatusBadgeProps = {
  readonly status: TourUiStatus;
};

export function TourStatusBadge({ status }: TourStatusBadgeProps) {
  const t = useTranslations("tours.status");

  return (
    <Badge variant={VARIANT[status]} data-tour-status={status}>
      {t(status)}
    </Badge>
  );
}
