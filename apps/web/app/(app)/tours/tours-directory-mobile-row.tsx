"use client";

import { TourInternalLink } from "@/features/tours/tour-internal-link";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TourListProjection } from "@/features/tours/operator-tours-types";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";
import { resolveTourKindDuration } from "@/features/tours/tour-list-category-logic";
import {
  formatTourDeparture,
  formatTourPrice,
  formatTourSeats,
  formatTourUpdatedAt,
} from "@/features/tours/tour-list-formatters";
import { resolveTourPriceDisplayPolicy } from "@/features/tours/resolve-tour-price-display-policy";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";
import { resolveWizardTourDurationLabel } from "@/wizard/wizard-label-surface-registry";
import type { AppLocale } from "@/i18n/routing";

import { TourCategoryBadge } from "@/admin/patterns/tour-category-badge";

import { resolveTourCardActionHierarchy } from "./tour-card";
import { TourDuplicateActions } from "./tour-duplicate-actions";
import { TourStatusBadge } from "./tour-status-badge";

type ToursDirectoryMobileRowProps = {
  readonly pluginId: string;
  readonly tour: TourListProjection;
  readonly canManage: boolean;
  readonly showExtendedMeta: boolean;
};

export function ToursDirectoryMobileRow({
  pluginId,
  tour,
  canManage,
  showExtendedMeta,
}: ToursDirectoryMobileRowProps) {
  const locale = useLocale() as AppLocale;
  const tCard = useTranslations("tours.card");
  const tFormat = useTranslations("tours.format");
  const tTable = useTranslations("tours.table");
  const tWorkspace = useWorkspaceWizardTranslator(pluginId);
  const pricePolicy = resolveTourPriceDisplayPolicy(pluginId);

  const departureLabel = formatTourDeparture(tour.departureAt, locale);
  const seatsLabel = formatTourSeats(tour, {
    withCapacity: (accepted, capacity) =>
      tFormat("seatsWithCapacity", { accepted, capacity }),
    open: (accepted) => tFormat("seatsOpen", { accepted }),
  });
  const priceLabel = formatTourPrice(tour.priceAmount, tour.priceCurrency, locale, pricePolicy);
  const updatedLabel = formatTourUpdatedAt(tour.updatedAt, locale);
  const durationSlug = showExtendedMeta ? resolveTourKindDuration(pluginId, tour.category) : null;
  const durationLabel =
    durationSlug !== null
      ? resolveWizardTourDurationLabel(pluginId, tWorkspace, durationSlug)
      : null;
  const actionHierarchy = resolveTourCardActionHierarchy(tour.uiStatus, canManage);

  return (
    <div
      className="rounded-xl border bg-card p-4 shadow-sm"
      data-testid={TOURS_LIST_TEST_IDS.mobileRow}
    >
      <div className="space-y-1">
        <p className="break-words font-medium leading-6">{tour.title}</p>
        {tour.shortDescription ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{tour.shortDescription}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{tCard("noDescription")}</p>
        )}
      </div>
      <div
        className="mt-3 flex flex-wrap items-center gap-1.5"
        data-testid={TOURS_LIST_TEST_IDS.rowMeta}
      >
        <TourStatusBadge status={tour.uiStatus} />
        <TourCategoryBadge pluginId={pluginId} category={tour.category} />
        {durationLabel ? (
          <Badge variant="secondary" className="text-xs font-normal">
            {durationLabel}
          </Badge>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{tTable("schedule")}</dt>
          <dd className="mt-0.5 text-foreground">{departureLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{tTable("capacity")}</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">{seatsLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{tTable("price")}</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">{priceLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{tTable("updated")}</dt>
          <dd className="mt-0.5 text-foreground">{updatedLabel ?? "—"}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild variant={actionHierarchy.editVariant} size="sm" className="flex-1 sm:flex-none">
          <TourInternalLink href={`/tours/${tour.id}/edit`}>{tCard("view")}</TourInternalLink>
        </Button>
        {canManage ? (
          <Button
            asChild
            variant={actionHierarchy.workspaceVariant}
            size="sm"
            className="flex-1 sm:flex-none"
            data-testid={TOURS_LIST_TEST_IDS.workspace}
          >
            <TourInternalLink href={`/tours/${tour.id}/workspace`}>{tCard("workspace")}</TourInternalLink>
          </Button>
        ) : null}
        {canManage ? <TourDuplicateActions tourId={tour.id} /> : null}
      </div>
    </div>
  );
}
