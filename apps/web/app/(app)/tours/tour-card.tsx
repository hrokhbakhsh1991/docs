"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { TourListProjection } from "@/features/tours/operator-tours-types";
import {
  formatTourDeparture,
  formatTourPrice,
  formatTourSeats,
} from "@/features/tours/tour-list-formatters";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";
import type { AppLocale } from "@/i18n/routing";

import { TourCategoryBadge } from "@/admin/patterns/tour-category-badge";

import { TourDuplicateActions } from "./tour-duplicate-actions";
import { TourStatusBadge } from "./tour-status-badge";

type TourCardProps = {
  readonly tour: TourListProjection;
  readonly canManage: boolean;
};

export function TourCard({ tour, canManage }: TourCardProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.card");
  const tFormat = useTranslations("tours.format");
  const priceLabel = formatTourPrice(tour.priceAmount, tour.priceCurrency, locale);
  const departureLabel = formatTourDeparture(tour.departureAt, locale);
  const seatsLabel = formatTourSeats(tour, {
    withCapacity: (accepted, capacity) =>
      tFormat("seatsWithCapacity", { accepted, capacity }),
    open: (accepted) => tFormat("seatsOpen", { accepted }),
  });

  return (
    <Card data-denali-surface="card" className="flex h-full flex-col overflow-hidden shadow-sm transition-shadow">
      {tour.coverImageUrl ? (
        <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
          <img
            src={tour.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <TourStatusBadge status={tour.uiStatus} />
          <TourCategoryBadge category={tour.category} />
        </div>
        <CardTitle className="line-clamp-2 text-lg">{tour.title}</CardTitle>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {departureLabel ? <span>{departureLabel}</span> : null}
          {priceLabel ? <span>{priceLabel}</span> : null}
          <span>{seatsLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {tour.shortDescription ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{tour.shortDescription}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Link href={`/tours/${tour.id}/edit`}>
          <Button type="button" variant="secondary" size="sm">
            {t("view")}
          </Button>
        </Link>
        {canManage ? (
          <Link href={`/tours/${tour.id}/workspace`} data-testid={TOURS_LIST_TEST_IDS.workspace}>
            <Button type="button" variant="outline" size="sm">
              {t("workspace")}
            </Button>
          </Link>
        ) : null}
        {canManage ? <TourDuplicateActions tourId={tour.id} /> : null}
      </CardFooter>
    </Card>
  );
}
