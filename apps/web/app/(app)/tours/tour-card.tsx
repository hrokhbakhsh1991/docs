"use client";

import { TourInternalLink } from "@/features/tours/tour-internal-link";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { TourListProjection } from "@/features/tours/operator-tours-types";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";
import {
  resolveTourKindDuration,
} from "@/features/tours/tour-list-category-logic";
import {
  formatTourDeparture,
  formatTourPrice,
  formatTourSeats,
} from "@/features/tours/tour-list-formatters";
import { resolveTourPriceDisplayPolicy } from "@/features/tours/resolve-tour-price-display-policy";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";
import { resolveWizardTourDurationLabel } from "@/wizard/wizard-label-surface-registry";
import type { AppLocale } from "@/i18n/routing";

import { TourCategoryBadge } from "@/admin/patterns/tour-category-badge";

import { TourDuplicateActions } from "./tour-duplicate-actions";
import { TourStatusBadge } from "./tour-status-badge";
import { TourListCoverImage } from "@/features/tours/tour-list-cover-image";

type TourCardProps = {
  readonly pluginId: string;
  readonly tour: TourListProjection;
  readonly canManage: boolean;
  readonly showExtendedCard?: boolean;
};

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

function TourCardCover({
  coverImageUrl,
  coverImageStorageKey,
  noCoverLabel,
}: {
  readonly coverImageUrl: string | null;
  readonly coverImageStorageKey: string | null;
  readonly noCoverLabel: string;
}) {
  return (
    <TourListCoverImage
      coverImageUrl={coverImageUrl}
      coverImageStorageKey={coverImageStorageKey}
      noCoverLabel={noCoverLabel}
      testId={TOURS_LIST_TEST_IDS.cardCover}
    />
  );
}

export function TourCard({ pluginId, tour, canManage, showExtendedCard = false }: TourCardProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.card");
  const tFormat = useTranslations("tours.format");
  const tWorkspace = useWorkspaceWizardTranslator(pluginId);
  const priceLabel = formatTourPrice(
    tour.priceAmount,
    tour.priceCurrency,
    locale,
    resolveTourPriceDisplayPolicy(pluginId)
  );
  const departureLabel = formatTourDeparture(tour.departureAt, locale);
  const seatsLabel = formatTourSeats(tour, {
    withCapacity: (accepted, capacity) =>
      tFormat("seatsWithCapacity", { accepted, capacity }),
    open: (accepted) => tFormat("seatsOpen", { accepted }),
  });
  const durationSlug = showExtendedCard ? resolveTourKindDuration(pluginId, tour.category) : null;
  const durationLabel =
    durationSlug !== null
      ? resolveWizardTourDurationLabel(pluginId, tWorkspace, durationSlug)
      : null;

  const actionHierarchy = resolveTourCardActionHierarchy(tour.uiStatus, canManage);

  return (
    <Card
      data-operator-surface="card"
      className="flex h-full flex-col overflow-hidden shadow-sm transition-shadow"
    >
      <CardHeader className="space-y-3 pb-2">
        <CardTitle className="line-clamp-2 text-lg">{tour.title}</CardTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          <TourStatusBadge status={tour.uiStatus} />
          <TourCategoryBadge pluginId={pluginId} category={tour.category} />
          {durationLabel ? (
            <Badge
              variant="secondary"
              className="text-xs font-normal"
              data-testid={TOURS_LIST_TEST_IDS.cardDuration}
            >
              {durationLabel}
            </Badge>
          ) : null}
        </div>
        <div
          className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"
          data-testid={TOURS_LIST_TEST_IDS.cardMeta}
        >
          {departureLabel ? (
            <div>
              <span className="font-medium text-foreground">{t("departure")}:</span>{" "}
              <span>{departureLabel}</span>
            </div>
          ) : null}
          <div>
            <span className="font-medium text-foreground">{t("capacity")}:</span>{" "}
            <span>{seatsLabel}</span>
          </div>
        </div>
        {priceLabel ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{t("price")}:</span>{" "}
            <span>{priceLabel}</span>
          </p>
        ) : null}
      </CardHeader>
      <TourCardCover
        coverImageUrl={tour.coverImageUrl}
        coverImageStorageKey={tour.coverImageStorageKey}
        noCoverLabel={t("noCover")}
      />
      <CardContent className="flex-1">
        {tour.shortDescription ? (
          <p className={`text-sm text-muted-foreground ${showExtendedCard ? "line-clamp-3" : "line-clamp-2"}`}>
            {tour.shortDescription}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button asChild variant={actionHierarchy.editVariant} size="sm">
          <TourInternalLink href={`/tours/${tour.id}/edit`}>{t("view")}</TourInternalLink>
        </Button>
        {canManage ? (
          <Button
            asChild
            variant={actionHierarchy.workspaceVariant}
            size="sm"
            data-testid={TOURS_LIST_TEST_IDS.workspace}
          >
            <TourInternalLink href={`/tours/${tour.id}/workspace`}>{t("workspace")}</TourInternalLink>
          </Button>
        ) : null}
        {canManage ? <TourDuplicateActions tourId={tour.id} /> : null}
      </CardFooter>
    </Card>
  );
}
