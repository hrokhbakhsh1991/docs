"use client";

import { TourInternalLink } from "@/features/tours/tour-internal-link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { TourListProjection } from "@/features/tours/operator-tours-types";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";

import { TourDuplicateActions } from "./tour-duplicate-actions";

export function resolveTourCardActionHierarchy(
  status: TourListProjection["uiStatus"],
  canManage: boolean
): {
  readonly editVariant: "default" | "outline";
  readonly workspaceVariant: "default" | "outline";
} {
  const workspacePrimary = canManage && status === "active";
  return {
    editVariant: workspacePrimary ? "outline" : "default",
    workspaceVariant: workspacePrimary ? "default" : "outline",
  };
}

type TourListRowActionsProps = {
  readonly tour: TourListProjection;
  readonly canManage: boolean;
  readonly compact?: boolean;
};

export function TourListRowActions({
  tour,
  canManage,
  compact = false,
}: TourListRowActionsProps) {
  const t = useTranslations("tours.card");
  const actionHierarchy = resolveTourCardActionHierarchy(tour.uiStatus, canManage);

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5${compact ? "" : " justify-end"}`}
      data-testid={TOURS_LIST_TEST_IDS.rowActions}
    >
      <Button asChild variant={actionHierarchy.editVariant} size="sm" className="h-8 whitespace-nowrap">
        <TourInternalLink href={`/tours/${tour.id}/edit`}>{t("view")}</TourInternalLink>
      </Button>
      {canManage ? (
        <Button
          asChild
          variant={actionHierarchy.workspaceVariant}
          size="sm"
          className="h-8 whitespace-nowrap"
          data-testid={TOURS_LIST_TEST_IDS.workspace}
        >
          <TourInternalLink href={`/tours/${tour.id}/workspace`}>{t("workspace")}</TourInternalLink>
        </Button>
      ) : null}
      {canManage ? <TourDuplicateActions tourId={tour.id} iconOnly={compact} /> : null}
    </div>
  );
}
