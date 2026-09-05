"use client";

import { useTranslations } from "next-intl";

import { TourCategoryBadge } from "@/admin/patterns/tour-category-badge";
import type { TourListProjection } from "@/features/tours/operator-tours-types";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";
import { useTourListRowModel } from "@/features/tours/use-tour-list-row-model";

import { TourListRowActions } from "./tour-list-row-actions";
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
  const t = useTranslations("tours.table");
  const row = useTourListRowModel(pluginId, tour, showExtendedMeta);

  return (
    <article
      className="rounded-xl border bg-card/40 p-4 shadow-sm"
      data-testid={TOURS_LIST_TEST_IDS.row}
      data-tour-id={tour.id}
      data-operator-surface="list-row"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h2 className="line-clamp-2 text-base font-semibold leading-5">{tour.title}</h2>
            <div
              className="flex flex-wrap items-center gap-1.5"
              data-testid={TOURS_LIST_TEST_IDS.rowMeta}
            >
              <TourStatusBadge status={tour.uiStatus} />
              <TourCategoryBadge pluginId={pluginId} category={tour.category} />
              {row.durationLabel ? (
                <span className="text-xs text-muted-foreground" data-testid={TOURS_LIST_TEST_IDS.cardDuration}>
                  {row.durationLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t("departure")}</dt>
            <dd dir="ltr" className="tabular-nums">
              {row.departureLabel ?? t("noDeparture")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("capacity")}</dt>
            <dd dir="ltr" className="tabular-nums" data-testid={TOURS_LIST_TEST_IDS.cardMeta}>
              {row.seatsLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("price")}</dt>
            <dd dir="ltr" className="tabular-nums">
              {row.priceLabel ?? t("noPrice")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("updated")}</dt>
            <dd dir="ltr" className="tabular-nums text-muted-foreground">{row.updatedLabel}</dd>
          </div>
        </dl>

        {tour.shortDescription ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{tour.shortDescription}</p>
        ) : null}

        <TourListRowActions tour={tour} canManage={canManage} />
      </div>
    </article>
  );
}
