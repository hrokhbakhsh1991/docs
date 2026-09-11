"use client";

import { useTranslations } from "next-intl";

import { TourCategoryBadge } from "@/admin/patterns/tour-category-badge";
import type { TourListProjection } from "@/features/tours/operator-tours-types";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";
import { useTourListRowModel } from "@/features/tours/use-tour-list-row-model";

import { TourListRowActions } from "./tour-list-row-actions";
import { TourStatusBadge } from "./tour-status-badge";

const HEAD_CELL =
  "border-b border-border/70 px-4 py-3 text-start align-middle text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-muted-foreground";
const BODY_CELL = "border-b border-border/60 px-4 py-3 text-start align-middle";

type ToursDirectoryTableProps = {
  readonly pluginId: string;
  readonly tours: readonly TourListProjection[];
  readonly canManage: boolean;
  readonly showExtendedMeta: boolean;
};

function EmptyCellValue({ label }: { readonly label: string }) {
  return <span className="text-muted-foreground">{label}</span>;
}

export function ToursDirectoryTable({
  pluginId,
  tours,
  canManage,
  showExtendedMeta,
}: ToursDirectoryTableProps) {
  const t = useTranslations("tours.table");

  return (
    <div
      className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm lg:block"
      data-testid={TOURS_LIST_TEST_IDS.tableDesktop}
    >
      <table
        className="w-full min-w-[62rem] border-separate border-spacing-0 text-sm"
        data-operator-tours-table
      >
        <thead className="bg-muted/50">
          <tr>
            <th className={`${HEAD_CELL} min-w-[16rem]`} scope="col">
              {t("tour")}
            </th>
            <th className={`${HEAD_CELL} w-[7rem]`} scope="col">
              {t("status")}
            </th>
            <th className={`${HEAD_CELL} w-[10rem]`} scope="col">
              {t("departure")}
            </th>
            <th className={`${HEAD_CELL} w-[8rem]`} scope="col">
              {t("capacity")}
            </th>
            <th className={`${HEAD_CELL} w-[8rem]`} scope="col">
              {t("price")}
            </th>
            <th className={`${HEAD_CELL} w-[10rem]`} scope="col">
              {t("updated")}
            </th>
            <th className={`${HEAD_CELL} sticky left-0 z-20 w-[15rem] bg-muted`} scope="col">
              {t("actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {tours.map((tour) => (
            <TourDirectoryTableRow
              key={tour.id}
              pluginId={pluginId}
              tour={tour}
              canManage={canManage}
              showExtendedMeta={showExtendedMeta}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TourDirectoryTableRow({
  pluginId,
  tour,
  canManage,
  showExtendedMeta,
}: {
  readonly pluginId: string;
  readonly tour: TourListProjection;
  readonly canManage: boolean;
  readonly showExtendedMeta: boolean;
}) {
  const t = useTranslations("tours.table");
  const row = useTourListRowModel(pluginId, tour, showExtendedMeta);

  return (
    <tr
      className="transition-colors odd:bg-background/20 hover:bg-accent/40 focus-within:bg-accent/40 last:[&>td]:border-b-0"
      data-testid={TOURS_LIST_TEST_IDS.row}
      data-tour-id={tour.id}
    >
      <td className={`${BODY_CELL} font-medium`}>
        <div className="min-w-0 space-y-1">
          <p className="truncate leading-5">{tour.title}</p>
          <div
            className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
            data-testid={TOURS_LIST_TEST_IDS.rowMeta}
          >
            <TourCategoryBadge pluginId={pluginId} category={tour.category} />
            {row.durationLabel ? (
              <span data-testid={TOURS_LIST_TEST_IDS.cardDuration}>{row.durationLabel}</span>
            ) : null}
            {tour.shortDescription ? (
              <span className="truncate">{tour.shortDescription}</span>
            ) : null}
          </div>
        </div>
      </td>
      <td className={`${BODY_CELL} sticky left-0 z-10 min-w-[15rem] bg-card`}>
        <TourStatusBadge status={tour.uiStatus} />
      </td>
      <td className={`${BODY_CELL} whitespace-nowrap`}>
        {row.departureLabel ? (
          <span dir="ltr" className="inline-block tabular-nums">
            {row.departureLabel}
          </span>
        ) : (
          <EmptyCellValue label={t("noDeparture")} />
        )}
      </td>
      <td className={`${BODY_CELL} whitespace-nowrap`}>
        <span
          dir="ltr"
          className="inline-block tabular-nums"
          data-testid={TOURS_LIST_TEST_IDS.cardMeta}
        >
          {row.seatsLabel}
        </span>
      </td>
      <td className={`${BODY_CELL} whitespace-nowrap`}>
        {row.priceLabel ? (
          <span dir="ltr" className="inline-block tabular-nums">
            {row.priceLabel}
          </span>
        ) : (
          <EmptyCellValue label={t("noPrice")} />
        )}
      </td>
      <td className={`${BODY_CELL} whitespace-nowrap`}>
        <span dir="ltr" className="inline-block tabular-nums text-muted-foreground">
          {row.updatedLabel}
        </span>
      </td>
      <td className={BODY_CELL}>
        <TourListRowActions tour={tour} canManage={canManage} compact />
      </td>
    </tr>
  );
}
