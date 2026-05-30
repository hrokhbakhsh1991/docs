"use client";

import { memo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { TourCard } from "@/components/tours/TourCard";

import { EmptyState } from "@tour/ui";

import type { TourDetailDto } from "@/lib/services/tours.service";

import { TourStatusBadge } from "../tour-status-badge";

import gridStyles from "./tour-list-grid.module.css";

export type TourListProps = {
  tours: TourDetailDto[];
  /** Selection / navigation — e.g. push to `/tours/:id/edit`. */
  onSelectTour?: (_tourId: string) => void;
  onDuplicateTour?: (_tour: TourDetailDto) => void;
  onDeleteTour?: (_tour: TourDetailDto) => void;
  emptyState?: ReactNode;
};

function TourListComponent({ tours, onSelectTour, onDuplicateTour, onDeleteTour, emptyState }: TourListProps) {
  const t = useTranslations("tours.list");
  const tCard = useTranslations("tours.card");
  if (tours.length === 0) {
    return (
      emptyState ?? (
        <EmptyState embedded title={t("emptyListTitle")} description={t("emptyListDesc")} />
      )
    );
  }

  return (
    <ul className={gridStyles.grid} aria-label={t("listAriaLabel")}>
      {tours.map((tour) => (
        <li key={tour.id}>
          <TourCard
            tour={tour}
            accessory={<TourStatusBadge lifecycleStatus={tour.lifecycleStatus} />}
            {...(onSelectTour
              ? {
                  primaryActionLabel: t("viewDetails"),
                  onPrimaryActionClick: () => onSelectTour(tour.id),
                }
              : {})}
            {...(onDuplicateTour
              ? {
                  duplicateActionLabel: t("duplicate"),
                  onDuplicateActionClick: () => onDuplicateTour(tour),
                }
              : {})}
            {...(onDeleteTour
              ? {
                  secondaryActionLabel: tCard("delete"),
                  onSecondaryActionClick: () => onDeleteTour(tour),
                }
              : {})}
          />
        </li>
      ))}
    </ul>
  );
}

export const TourList = memo(TourListComponent);
