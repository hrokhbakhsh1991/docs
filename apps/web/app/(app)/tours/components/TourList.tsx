"use client";

import { memo, type ReactNode } from "react";

import { TourCard } from "@/components/tours/TourCard";

import { EmptyState } from "@tour/ui";

import type { TourDetailDto } from "@/lib/services/tours.service";

import { TourStatusBadge } from "../tour-status-badge";

import gridStyles from "./tour-list-grid.module.css";

export type TourListProps = {
  tours: TourDetailDto[];
  /** Selection / navigation — e.g. push to `/tours/:id/edit`. */
  onSelectTour?: (tourId: string) => void;
  onDeleteTour?: (tour: TourDetailDto) => void;
  emptyState?: ReactNode;
};

function TourListComponent({ tours, onSelectTour, onDeleteTour, emptyState }: TourListProps) {
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
                  primaryActionLabel: "View details" as const,
                  onPrimaryActionClick: () => onSelectTour(tour.id),
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
