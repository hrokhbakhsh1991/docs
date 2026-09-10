"use client";

import { useTranslations } from "next-intl";

import { TourCategoryBadge } from "@/admin/patterns/tour-category-badge";
import type { TourListProjection } from "@/features/tours/operator-tours-types";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";
import { useTourListRowModel } from "@/features/tours/use-tour-list-row-model";

import { TourListRowActions } from "./tour-list-row-actions";
import { TourStatusBadge } from "./tour-status-badge";

const HEAD_CELL =
  "px-4 py-3 text-start align-middle font-medium whitespace-nowrap text-muted-foreground";
const BODY_CELL = "px-4 py-3 text-start align-middle";

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
      className="hidden overflow-x-auto rounded-xl border bg-card/40 lg:block"
      data-testid={TOURS_LIST_TEST_IDS.tableDesktop}
    >
      <table className="w-full min-w-[56rem] border-collapse text-sm" data-operator-tours-table>
        <thead className="border-b bg-muted/40">
          <tr>
            <th className={`${HEAD_CELL} min-w-[16rem]`} scope="col">{t("tour")}</th>
            <th className={`${HEAD_CELL} w-[7rem]`} scope="col">{t("status")}</th>
            <th className={`${HEAD_CELL} w-[10rem]`} scope="col">{t("departure")}</th>
            <th className={`${HEAD_CELL} w-[8rem]`} scope="col">{t("capacity")}</th>
            <th className={`${HEAD_CELL} w-[8rem]`} scope="col">{t("price")}</th>
            <th className={`${HEAD_CELL} w-[10rem]`} scope="col">{t("updated")}</th>
            <th className={`${HEAD_CELL} w-[12rem]`} scope="col">{t("actions")}</th>
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
      className="border-b transition-colors hover:bg-muted/30 focus-within:bg-muted/30 last:border-b-0"
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
      <td className={BODY_CELL}>
        <TourStatusBadge status={tour.uiStatus} />
      </td>
      <td className={BODY_CELL}>
        {row.departureLabel ? (
          <span dir="ltr" className="inline-block tabular-nums">{row.departureLabel}</span>
        ) : (
          <EmptyCellValue label={t("noDeparture")} />
        )}
      </td>
      <td className={BODY_CELL}>
        <span dir="ltr" className="inline-block tabular-nums" data-testid={TOURS_LIST_TEST_IDS.cardMeta}>
          {row.seatsLabel}
        </span>
      </td>
      <td className={BODY_CELL}>
        {row.priceLabel ? (
          <span dir="ltr" className="inline-block tabular-nums">{row.priceLabel}</span>
        ) : (
          <EmptyCellValue label={t("noPrice")} />
        )}
      </td>
      <td className={BODY_CELL}>
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
