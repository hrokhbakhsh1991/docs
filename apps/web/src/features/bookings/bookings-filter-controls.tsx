"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { clearBookingsCommandCenterFilters } from "@/features/bookings/bookings-command-center-logic";
import { BookingsTourChipScopeToggle } from "@/features/bookings/bookings-tour-chip-scope-toggle";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  BOOKINGS_LIST_SORT_OPTIONS,
  BOOKING_STATUS_FILTER_OPTIONS,
  PAYMENT_STATUS_FILTER_OPTIONS,
  type BookingsCommandCenterQuery,
  type BookingsListSort,
} from "@/features/bookings/bookings-command-center-types";

type BookingsFilterControlsProps = {
  readonly query: BookingsCommandCenterQuery;
  readonly hasActiveFilters: boolean;
  readonly onReplaceQuery: (next: BookingsCommandCenterQuery) => void;
  /** UX-BKG-53 — Show all tours lives in advanced Filters. */
  readonly showTourScope?: boolean;
};

export function BookingsFilterControls({
  query,
  hasActiveFilters,
  onReplaceQuery,
  showTourScope = false,
}: BookingsFilterControlsProps) {
  const t = useTranslations("bookings");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">{t("advancedFiltersHeading")}</p>
      <div className="flex flex-wrap gap-1">
        {BOOKING_STATUS_FILTER_OPTIONS.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={query.status === status ? "default" : "outline"}
            onClick={() =>
              onReplaceQuery({ ...query, status, approvedWithinDays: "" })
            }
          >
            {t(`status.${status}`)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {PAYMENT_STATUS_FILTER_OPTIONS.map((paymentStatus) => (
          <Button
            key={paymentStatus}
            size="sm"
            variant={query.paymentStatus === paymentStatus ? "default" : "outline"}
            onClick={() => onReplaceQuery({ ...query, paymentStatus })}
          >
            {t(`payment.${paymentStatus}`)}
          </Button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="whitespace-nowrap">{t("sortLabel")}</span>
        <select
          className="h-8 rounded-md border bg-background px-2 text-foreground"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.sortSelect}
          value={query.sort}
          onChange={(event) =>
            onReplaceQuery({
              ...query,
              sort: event.target.value as BookingsListSort,
            })
          }
        >
          {BOOKINGS_LIST_SORT_OPTIONS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`sort.${sort}`)}
            </option>
          ))}
        </select>
      </label>
      {showTourScope ? (
        <div className="flex flex-wrap items-center gap-2">
          <BookingsTourChipScopeToggle query={query} onReplaceQuery={onReplaceQuery} />
        </div>
      ) : null}
      {hasActiveFilters ? (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.clearFiltersButton}
          onClick={() => onReplaceQuery(clearBookingsCommandCenterFilters(query))}
        >
          {t("clearFilters")}
        </Button>
      ) : null}
    </div>
  );
}
