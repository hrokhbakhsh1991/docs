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
  const priceLabel = formatTourPrice(tour.priceAmount, tour.priceCurrency, locale, pluginId);
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

  const metaParts = [departureLabel, priceLabel, seatsLabel].filter(
    (part): part is string => part !== null && part.length > 0
  );

  return (
    <Card
      data-operator-surface="card"
      className="flex h-full flex-col overflow-hidden shadow-sm transition-shadow"
    >
      <TourCardCover
        coverImageUrl={tour.coverImageUrl}
        coverImageStorageKey={tour.coverImageStorageKey}
        noCoverLabel={t("noCover")}
      />
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
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
        <CardTitle className="line-clamp-2 text-lg">{tour.title}</CardTitle>
        {metaParts.length > 0 ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid={TOURS_LIST_TEST_IDS.cardMeta}
          >
            {metaParts.join(" · ")}
          </p>
        ) : null}
      </CardHeader>
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
        <Button asChild variant="secondary" size="sm">
          <TourInternalLink href={`/tours/${tour.id}/edit`}>{t("view")}</TourInternalLink>
        </Button>
        {canManage ? (
          <Button asChild variant="outline" size="sm" data-testid={TOURS_LIST_TEST_IDS.workspace}>
            <TourInternalLink href={`/tours/${tour.id}/workspace`}>{t("workspace")}</TourInternalLink>
          </Button>
        ) : null}
        {canManage ? <TourDuplicateActions tourId={tour.id} /> : null}
      </CardFooter>
    </Card>
  );
}
