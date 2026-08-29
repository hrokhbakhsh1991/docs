"use client";

import { Filter, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  applyBookingsDepartureWindowChip,
  bookingsAdvancedFiltersDirty,
  BOOKINGS_DEPARTURE_WINDOW_DAYS,
  clearBookingsCommandCenterFilters,
  isBookingsDepartureWindowChipActive,
  withBookingsPaginationReset,
} from "@/features/bookings/bookings-command-center-logic";
import { BookingsLayoutSwitch } from "@/features/bookings/bookings-layout-switch";
import {
  BOOKINGS_OPS_PRESET_IDS,
  applyBookingsOpsPreset,
  resolveActiveBookingsOpsPreset,
} from "@/features/bookings/bookings-ops-path-logic";
import { BookingsTourChipScopeToggle } from "@/features/bookings/bookings-tour-chip-scope-toggle";
import { BookingsTourFilter } from "@/features/bookings/bookings-tour-filter";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  BOOKINGS_LIST_SORT_OPTIONS,
  BOOKINGS_QUEUE_STATUS_OPTIONS,
  DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
  PAYMENT_STATUS_FILTER_OPTIONS,
  type BookingTourChip,
  type BookingsCommandCenterQuery,
} from "@/features/bookings/bookings-command-center-types";

type BookingsDirectoryControlsProps = {
  readonly query: BookingsCommandCenterQuery;
  readonly searchInput: string;
  readonly onSearchInputChange: (value: string) => void;
  readonly onReplaceQuery: (next: BookingsCommandCenterQuery) => void;
  readonly tourChips?: readonly BookingTourChip[];
  readonly showTourFilter?: boolean;
  readonly showTourScope?: boolean;
};

function resolveTourChipTitle(
  chips: readonly BookingTourChip[],
  tourId: string
): string | null {
  const match = chips.find((chip) => chip.tourId === tourId);
  return match?.tourTitle ?? null;
}

export function BookingsDirectoryControls({
  query,
  searchInput,
  onSearchInputChange,
  onReplaceQuery,
  tourChips = [],
  showTourFilter = false,
  showTourScope = false,
}: BookingsDirectoryControlsProps) {
  const t = useTranslations("bookings");
  const filtersDirty = bookingsAdvancedFiltersDirty(query);

  const patchQuery = (patch: Partial<BookingsCommandCenterQuery>) => {
    onReplaceQuery(withBookingsPaginationReset({ ...query, ...patch }));
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (query.status !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.status) {
      chips.push({
        key: "status",
        label: t("activeFilters.status", { value: t(`status.${query.status}`) }),
        onRemove: () => patchQuery({ status: DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.status }),
      });
    }
    if (query.paymentStatus !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.paymentStatus) {
      chips.push({
        key: "payment",
        label: t("activeFilters.payment", { value: t(`payment.${query.paymentStatus}`) }),
        onRemove: () =>
          patchQuery({ paymentStatus: DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.paymentStatus }),
      });
    }
    if (query.tourId.length > 0) {
      const tourTitle = resolveTourChipTitle(tourChips, query.tourId) ?? query.tourId;
      chips.push({
        key: "tour",
        label: t("activeFilters.tour", { value: tourTitle }),
        onRemove: () => patchQuery({ tourId: "" }),
      });
    }
    if (query.departureWithinDays.length > 0) {
      chips.push({
        key: "departure",
        label: t("activeFilters.departure", { days: query.departureWithinDays }),
        onRemove: () => patchQuery({ departureWithinDays: "" }),
      });
    }
    if (query.approvedWithinDays.length > 0) {
      chips.push({
        key: "approved",
        label: t("activeFilters.approvedToday"),
        onRemove: () => patchQuery({ approvedWithinDays: "" }),
      });
    }
    if (query.tourChipScope === "all") {
      chips.push({
        key: "tourScope",
        label: t("activeFilters.allToursScope"),
        onRemove: () => patchQuery({ tourChipScope: "" }),
      });
    }
    if (query.layout !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.layout) {
      chips.push({
        key: "layout",
        label: t("activeFilters.layout", { value: t(`layout.${query.layout}`) }),
        onRemove: () => patchQuery({ layout: DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.layout }),
      });
    }
    if (query.sort !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.sort) {
      chips.push({
        key: "sort",
        label: t("activeFilters.sort", { value: t(`sort.${query.sort}`) }),
        onRemove: () => patchQuery({ sort: DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.sort }),
      });
    }
    if (query.search.length > 0) {
      chips.push({
        key: "search",
        label: t("activeFilters.search", { value: query.search }),
        onRemove: () => {
          onSearchInputChange("");
          patchQuery({ search: "" });
        },
      });
    }

    return chips;
  }, [onReplaceQuery, onSearchInputChange, query, t, tourChips]);

  const clearAll = () => {
    onSearchInputChange("");
    onReplaceQuery(withBookingsPaginationReset(clearBookingsCommandCenterFilters(query)));
  };

  return (
    <div className="space-y-3" data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.controls}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="relative min-w-0 max-w-xl flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {showTourFilter ? (
            <div className="min-w-0 sm:max-w-xs sm:flex-1">
              <BookingsTourFilter
                chips={tourChips}
                value={query.tourId}
                onValueChange={(tourId) =>
                  patchQuery({
                    tourId:
                      tourId.length === 0
                        ? ""
                        : query.tourId === tourId
                          ? ""
                          : tourId,
                  })
                }
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="bookings-queue-status" className="text-xs text-muted-foreground">
              {t("queueStatusLabel")}
            </Label>
            <select
              id="bookings-queue-status"
              className="flex h-9 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
              data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.queueStatus}
              value={query.status}
              onChange={(event) =>
                patchQuery({
                  status: event.target.value as BookingsCommandCenterQuery["status"],
                })
              }
            >
              {BOOKINGS_QUEUE_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </select>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2 self-start sm:self-auto"
                data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.filtersToggle}
              >
                <Filter className="h-4 w-4" aria-hidden />
                {t("filters.toggle")}
                {filtersDirty ? (
                  <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden />
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(100vw-2rem,22rem)] space-y-4 p-4"
              data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.filtersPanel}
            >
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t("presetsLabel")}</p>
                <div className="flex flex-wrap gap-1">
                  {BOOKINGS_OPS_PRESET_IDS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant={
                        resolveActiveBookingsOpsPreset(query) === preset ? "default" : "outline"
                      }
                      onClick={() =>
                        onReplaceQuery(
                          withBookingsPaginationReset(applyBookingsOpsPreset(query, preset))
                        )
                      }
                    >
                      {t(
                        preset === "workQueue"
                          ? "presets.workQueue"
                          : preset === "upcoming"
                            ? "presets.upcoming"
                            : "presets.history"
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t("upcomingWindow")}</p>
                <div className="flex flex-wrap gap-1">
                  {BOOKINGS_DEPARTURE_WINDOW_DAYS.map((days) => (
                    <Button
                      key={days}
                      type="button"
                      size="sm"
                      variant={
                        isBookingsDepartureWindowChipActive(query, days) ? "default" : "outline"
                      }
                      onClick={() =>
                        onReplaceQuery(
                          withBookingsPaginationReset(applyBookingsDepartureWindowChip(query, days))
                        )
                      }
                    >
                      {t(days === 7 ? "days7" : days === 14 ? "days14" : "days30")}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bookings-filter-payment">{t("paymentFilterLabel")}</Label>
                <select
                  id="bookings-filter-payment"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={query.paymentStatus}
                  onChange={(event) =>
                    patchQuery({
                      paymentStatus: event.target
                        .value as BookingsCommandCenterQuery["paymentStatus"],
                    })
                  }
                >
                  {PAYMENT_STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`payment.${option}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bookings-filter-sort">{t("sortLabel")}</Label>
                <select
                  id="bookings-filter-sort"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.sortSelect}
                  value={query.sort}
                  onChange={(event) =>
                    patchQuery({
                      sort: event.target.value as BookingsCommandCenterQuery["sort"],
                    })
                  }
                >
                  {BOOKINGS_LIST_SORT_OPTIONS.map((sort) => (
                    <option key={sort} value={sort}>
                      {t(`sort.${sort}`)}
                    </option>
                  ))}
                </select>
              </div>

              <BookingsLayoutSwitch
                query={query}
                onReplaceQuery={(next) =>
                  onReplaceQuery(withBookingsPaginationReset(next))
                }
                embedded
              />

              {showTourScope ? (
                <BookingsTourChipScopeToggle query={query} onReplaceQuery={onReplaceQuery} />
              ) : null}

              {filtersDirty || activeChips.length > 0 ? (
                <Button type="button" size="sm" variant="ghost" className="w-full" onClick={clearAll}>
                  {t("filters.clearAll")}
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.activeFilters}
        >
          {activeChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pe-1">
              <span>{chip.label}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-muted"
                aria-label={t("activeFilters.remove", { filter: chip.label })}
                onClick={chip.onRemove}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            {t("filters.clearAll")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
