"use client";

import { TourInternalLink } from "@/features/tours/tour-internal-link";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TourListProjection } from "@/features/tours/operator-tours-types";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";
import {
  resolveTourKindDuration,
} from "@/features/tours/tour-list-category-logic";
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

type ToursDirectoryTableProps = {
  readonly pluginId: string;
  readonly tours: readonly TourListProjection[];
  readonly canManage: boolean;
  readonly showExtendedMeta: boolean;
};

const HEAD_CELL =
  "px-4 py-3 text-start align-middle font-medium whitespace-nowrap text-muted-foreground";
const BODY_CELL = "px-4 py-3 text-start align-middle";

export function ToursDirectoryTable({
  pluginId,
  tours,
  canManage,
  showExtendedMeta,
}: ToursDirectoryTableProps) {
  const locale = useLocale() as AppLocale;
  const tCard = useTranslations("tours.card");
  const tFormat = useTranslations("tours.format");
  const tTable = useTranslations("tours.table");
  const tWorkspace = useWorkspaceWizardTranslator(pluginId);
  const pricePolicy = resolveTourPriceDisplayPolicy(pluginId);

  return (
    <div
      className="hidden overflow-x-auto rounded-xl border bg-card/40 lg:block"
      data-testid={TOURS_LIST_TEST_IDS.tableDesktop}
    >
      <table className="w-full min-w-[52rem] border-collapse text-sm" data-operator-tours-table>
        <thead className="border-b bg-muted/40">
          <tr>
            <th
              className={`${HEAD_CELL} min-w-[14rem]`}
              scope="col"
              data-testid={TOURS_LIST_TEST_IDS.tableTourHeader}
            >
              {tTable("tour")}
            </th>
            <th
              className={`${HEAD_CELL} min-w-[10rem]`}
              scope="col"
              data-testid={TOURS_LIST_TEST_IDS.tableStatusHeader}
            >
              {tTable("status")}
            </th>
            <th
              className={`${HEAD_CELL} w-[11rem]`}
              scope="col"
              data-testid={TOURS_LIST_TEST_IDS.tableScheduleHeader}
            >
              {tTable("schedule")}
            </th>
            <th
              className={`${HEAD_CELL} w-[8rem]`}
              scope="col"
              data-testid={TOURS_LIST_TEST_IDS.tableCapacityHeader}
            >
              {tTable("capacity")}
            </th>
            <th
              className={`${HEAD_CELL} w-[8rem]`}
              scope="col"
              data-testid={TOURS_LIST_TEST_IDS.tablePriceHeader}
            >
              {tTable("price")}
            </th>
            <th
              className={`${HEAD_CELL} w-[9rem]`}
              scope="col"
              data-testid={TOURS_LIST_TEST_IDS.tableUpdatedHeader}
            >
              {tTable("updated")}
            </th>
            <th
              className={`${HEAD_CELL} min-w-[12rem]`}
              scope="col"
              data-testid={TOURS_LIST_TEST_IDS.tableActionsHeader}
            >
              {tTable("actions")}
            </th>
          </tr>
        </thead>
        <tbody data-testid={TOURS_LIST_TEST_IDS.list}>
          {tours.map((tour) => {
            const departureLabel = formatTourDeparture(tour.departureAt, locale);
            const seatsLabel = formatTourSeats(tour, {
              withCapacity: (accepted, capacity) =>
                tFormat("seatsWithCapacity", { accepted, capacity }),
              open: (accepted) => tFormat("seatsOpen", { accepted }),
            });
            const priceLabel = formatTourPrice(
              tour.priceAmount,
              tour.priceCurrency,
              locale,
              pricePolicy
            );
            const updatedLabel = formatTourUpdatedAt(tour.updatedAt, locale);
            const durationSlug = showExtendedMeta
              ? resolveTourKindDuration(pluginId, tour.category)
              : null;
            const durationLabel =
              durationSlug !== null
                ? resolveWizardTourDurationLabel(pluginId, tWorkspace, durationSlug)
                : null;
            const actionHierarchy = resolveTourCardActionHierarchy(tour.uiStatus, canManage);

            return (
              <tr
                key={tour.id}
                className="border-b transition-colors hover:bg-muted/30 focus-within:bg-muted/30 last:border-b-0"
                data-testid={TOURS_LIST_TEST_IDS.row(tour.id)}
              >
                <td className={`${BODY_CELL} font-medium`}>
                  <div className="min-w-0 space-y-0.5">
                    <p className="line-clamp-2 leading-5">{tour.title}</p>
                    {tour.shortDescription ? (
                      <p className="line-clamp-1 text-sm font-normal leading-4 text-muted-foreground">
                        {tour.shortDescription}
                      </p>
                    ) : (
                      <p className="text-sm font-normal leading-4 text-muted-foreground">
                        {tCard("noDescription")}
                      </p>
                    )}
                  </div>
                </td>
                <td className={BODY_CELL}>
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    data-testid={TOURS_LIST_TEST_IDS.rowMeta}
                  >
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
                </td>
                <td className={`${BODY_CELL} text-muted-foreground`}>
                  {departureLabel ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className={`${BODY_CELL} tabular-nums text-muted-foreground`}>{seatsLabel}</td>
                <td className={`${BODY_CELL} tabular-nums text-muted-foreground`}>
                  {priceLabel ?? <span>—</span>}
                </td>
                <td className={`${BODY_CELL} text-muted-foreground`}>
                  {updatedLabel ?? <span>—</span>}
                </td>
                <td className={BODY_CELL}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant={actionHierarchy.editVariant} size="sm" className="h-8">
                      <TourInternalLink href={`/tours/${tour.id}/edit`}>{tCard("view")}</TourInternalLink>
                    </Button>
                    {canManage ? (
                      <Button
                        asChild
                        variant={actionHierarchy.workspaceVariant}
                        size="sm"
                        className="h-8"
                        data-testid={TOURS_LIST_TEST_IDS.workspace}
                      >
                        <TourInternalLink href={`/tours/${tour.id}/workspace`}>
                          {tCard("workspace")}
                        </TourInternalLink>
                      </Button>
                    ) : null}
                    {canManage ? <TourDuplicateActions tourId={tour.id} /> : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
