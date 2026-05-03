"use client";

import { memo, type ReactNode } from "react";

import { TourCard } from "@/components/tours/TourCard";

import { Card, CardBody, EmptyState } from "@tour/ui";

import type { TourDetailDto } from "../../../../lib/services/tours.service";

import { apiLifecycleToUi } from "../tour-ui-mappers";
import { TourStatusBadge } from "../tour-status-badge";

import styles from "./TourList.module.css";

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
      <Card>
        <CardBody>
          <div className={styles.emptyCardBody}>
            {emptyState ?? (
              <EmptyState title="No tours yet" description="Create a tour to see it listed here." />
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <ul className={styles.grid} aria-label="Tour list">
      {tours.map((tour) => (
        <li key={tour.id}>
          <TourCard
            tour={tour}
            accessory={<TourStatusBadge status={apiLifecycleToUi(tour.lifecycleStatus)} />}
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
