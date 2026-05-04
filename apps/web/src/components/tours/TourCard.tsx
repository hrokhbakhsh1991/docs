"use client";

import type { TourDto } from "@repo/types";
import type { HTMLAttributes, ReactNode } from "react";

import { Button, Card, cn } from "@tour/ui";

import { extractTourPriceUsd, formatTourLocation, formatTourPriceUsd } from "./formatters";

import styles from "./TourCard.module.css";

export type TourCardProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  tour: TourDto;
  onClick?: () => void;
  primaryActionLabel?: string;
  onPrimaryActionClick?: () => void;
  secondaryActionLabel?: string;
  onSecondaryActionClick?: () => void;
  className?: string;
  /** Optional UI slot (e.g. lifecycle badge — not part of `TourDto`). */
  accessory?: ReactNode;
};

export function TourCard({
  tour,
  onClick,
  primaryActionLabel,
  onPrimaryActionClick,
  secondaryActionLabel,
  onSecondaryActionClick,
  className,
  accessory,
  ...rest
}: TourCardProps) {
  const priceUsd = extractTourPriceUsd(tour.costContext);
  const seatsRemaining =
    tour.totalCapacity > 0 ? Math.max(0, tour.totalCapacity - tour.acceptedCount) : null;
  const desc = (tour.description ?? "").trim();

  const hasFooterActions =
    (primaryActionLabel != null && onPrimaryActionClick != null) ||
    (secondaryActionLabel != null && onSecondaryActionClick != null);

  const actions = hasFooterActions ? (
    <>
      {secondaryActionLabel != null && onSecondaryActionClick != null ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          {...(secondaryActionLabel === "Delete"
            ? ({ "data-testid": `tour-delete-${tour.id}` } as const)
            : {})}
          onClick={(e) => {
            e.stopPropagation();
            onSecondaryActionClick();
          }}
        >
          {secondaryActionLabel}
        </Button>
      ) : null}
      {primaryActionLabel != null && onPrimaryActionClick != null ? (
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onPrimaryActionClick();
          }}
        >
          {primaryActionLabel}
        </Button>
      ) : null}
    </>
  ) : undefined;

  return (
    <Card
      className={cn(styles.wrap, className)}
      title={tour.title}
      description={<span className={styles.tourId}>{tour.id}</span>}
      actions={actions}
      onClick={onClick}
      {...rest}
    >
      <div className={styles.summary}>
        <p style={{ margin: 0 }}>
          <strong>Location:</strong> {formatTourLocation(tour)}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Capacity:</strong>{" "}
          {tour.totalCapacity > 0
            ? `${seatsRemaining} seats left (${tour.acceptedCount}/${tour.totalCapacity} filled)`
            : "—"}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Price:</strong> {formatTourPriceUsd(priceUsd)}
        </p>
        {desc ? (
          <p style={{ margin: 0 }}>
            <strong>About:</strong> {desc}
          </p>
        ) : null}
      </div>
      {accessory ? <div className={styles.accessory}>{accessory}</div> : null}
    </Card>
  );
}
