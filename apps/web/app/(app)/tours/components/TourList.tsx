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
  if (tours.length === 0) {
    return (
      emptyState ?? (
        <EmptyState embedded title="No tours yet" description="Create a tour to see it listed here." />
      )
    );
  }

  return (
    <ul className={gridStyles.grid} aria-label="Tour list">
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
                  secondaryActionLabel: "Delete" as const,
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
