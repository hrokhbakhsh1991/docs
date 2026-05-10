"use client";

import type { TourDto } from "@repo/types";
import { useTranslations } from "next-intl";
import type { HTMLAttributes, ReactNode } from "react";

import { Button, Card, cn } from "@tour/ui";

import { extractTourPriceUsd, formatTourPriceUsd } from "./formatters";

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
  const t = useTranslations("tours.card");
  const priceUsd = extractTourPriceUsd(tour.costContext);
  const seatsRemaining =
    tour.totalCapacity > 0 ? Math.max(0, tour.totalCapacity - tour.acceptedCount) : null;
  const overview = tour.details?.tripDetails?.overview;
  const shortIntro =
    overview &&
    typeof overview === "object" &&
    !Array.isArray(overview) &&
    typeof (overview as Record<string, unknown>).shortIntro === "string"
      ? String((overview as Record<string, unknown>).shortIntro).trim()
      : "";
  const desc = (shortIntro || (tour.description ?? "").trim()).trim();

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
        <dl className={styles.locationField}>
          <dt className={styles.locationTerm}>{t("locationHeading")}</dt>
          <dd className={styles.locationDef}>
            {tour.destinationId && tour.destinationName ? (
              <span className={styles.destinationBlock}>
                <span className={styles.destinationName}>{tour.destinationName}</span>
                {tour.destinationRegionName ? (
                  <span className={styles.destinationRegion}>{tour.destinationRegionName}</span>
                ) : null}
              </span>
            ) : (
              <span className={styles.destinationNone}>{t("noDestination")}</span>
            )}
          </dd>
        </dl>
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
