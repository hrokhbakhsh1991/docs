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
  duplicateActionLabel?: string;
  onDuplicateActionClick?: () => void;
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
  duplicateActionLabel,
  onDuplicateActionClick,
  className,
  accessory,
  ...rest
}: TourCardProps) {
  const t = useTranslations("tours.card");
  const deleteLabel = t("delete");
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
    (secondaryActionLabel != null && onSecondaryActionClick != null) ||
    (duplicateActionLabel != null && onDuplicateActionClick != null);

  const actions = hasFooterActions ? (
    <>
      {duplicateActionLabel != null && onDuplicateActionClick != null ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={`tour-duplicate-${tour.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicateActionClick();
          }}
        >
          {duplicateActionLabel}
        </Button>
      ) : null}
      {secondaryActionLabel != null && onSecondaryActionClick != null ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          {...(secondaryActionLabel === deleteLabel
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

  const capacityValue =
    tour.totalCapacity > 0 ? (
      <>
        {t("remainingCapacity", { count: seatsRemaining ?? 0 })}{" "}
        {t("capacityFilled", {
          accepted: tour.acceptedCount,
          total: tour.totalCapacity,
        })}
      </>
    ) : (
      t("noDestination")
    );

  const priceValue = priceUsd > 0 ? formatTourPriceUsd(priceUsd) : t("free");

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
          <strong>{t("capacityLabel")}</strong> {capacityValue}
        </p>
        <p style={{ margin: 0 }}>
          <strong>{t("priceLabel")}</strong> {priceValue}
        </p>
        {desc ? (
          <p style={{ margin: 0 }}>
            <strong>{t("aboutLabel")}</strong> {desc}
          </p>
        ) : null}
      </div>
      {accessory ? <div className={styles.accessory}>{accessory}</div> : null}
    </Card>
  );
}
