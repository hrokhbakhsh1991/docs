"use client";

import {
  capacitySnapshotFillPercent,
  formatCapacitySnapshotLabel,
} from "@/features/bookings/bookings-command-center-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  type BookingListItem,
} from "@/features/bookings/bookings-command-center-types";
import type { AppLocale } from "@/i18n/routing";

type BookingCapacityBarProps = {
  readonly snapshot: NonNullable<BookingListItem["capacitySnapshot"]>;
  readonly locale: AppLocale;
  readonly compact?: boolean;
};

export function BookingCapacityBar({
  snapshot,
  locale,
  compact = false,
}: BookingCapacityBarProps) {
  const label = formatCapacitySnapshotLabel(snapshot, locale);
  const fill = capacitySnapshotFillPercent(snapshot);
  if (label === null) {
    return null;
  }
  return (
    <div
      className={compact ? "mt-1 space-y-1" : "space-y-1"}
      data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.capacityBar}
    >
      <p className={compact ? "text-[10px] text-muted-foreground" : "text-sm"}>{label}</p>
      {fill !== null ? (
        <div
          className={`overflow-hidden rounded-full bg-muted ${compact ? "h-1 w-24" : "h-1.5 w-32"}`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${fill}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
