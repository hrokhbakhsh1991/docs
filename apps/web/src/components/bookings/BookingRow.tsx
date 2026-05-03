"use client";

import type { BookingDto } from "@repo/types";
import type { HTMLAttributes } from "react";

import Link from "next/link";

import { Button } from "@tour/ui";

import { BookingStatusBadge } from "../../../app/(app)/bookings/booking-badges";
import listStyles from "../../../app/(app)/bookings/bookings.module.css";
import { formatTourDateLabel } from "../tours/formatters";

import styles from "./BookingRow.module.css";

export type BookingRowProps = Omit<HTMLAttributes<HTMLTableRowElement>, "onClick"> & {
  booking: BookingDto;
  tourName?: string;
  /** Optional denormalized tour price (USD number); omit when unknown. */
  tourPriceAmount?: number;
  /** Optional row-level handler (e.g. analytics); links stop propagation. */
  onClick?: () => void;
  onCancelClick?: () => void;
  className?: string;
};

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function BookingRow({
  booking,
  tourName,
  tourPriceAmount,
  onClick,
  onCancelClick,
  className,
  ...rest
}: BookingRowProps) {
  const tourLabel = tourName?.trim() || booking.tourId;

  return (
    <tr className={className} onClick={onClick} {...rest}>
      <td>
        <Link
          href={`/bookings/${booking.id}`}
          className={styles.cellLink}
          data-testid={`booking-detail-link-${booking.id}`}
          onClick={(e) => e.stopPropagation()}
        >
          {booking.id}
        </Link>
      </td>
      <td>
        <Link href={`/tours/${booking.tourId}/edit`} className={styles.cellLink} onClick={(e) => e.stopPropagation()}>
          {tourLabel}
        </Link>
        {typeof tourPriceAmount === "number" ? (
          <div className={listStyles.cellMuted}>{formatUsd(tourPriceAmount)}</div>
        ) : null}
      </td>
      <td>
        <div className={styles.mainLine}>{booking.participantFullName}</div>
      </td>
      <td>{formatTourDateLabel(booking.createdAt)}</td>
      <td>
        <BookingStatusBadge status={booking.status} />
      </td>
      <td>
        <div className={styles.actionsCell}>
          <Link href={`/bookings/${booking.id}`} className={styles.cellLink} onClick={(e) => e.stopPropagation()}>
            View
          </Link>
          {onCancelClick ? (
            <Button type="button" variant="danger" size="sm" onClick={(e) => {
              e.stopPropagation();
              onCancelClick();
            }}>
              Cancel
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
