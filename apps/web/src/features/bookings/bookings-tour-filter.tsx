"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { OperatorTourSelect } from "@/admin/patterns/operator-tour-select";
import type { OperatorSearchableSelectOption } from "@/admin/patterns/operator-searchable-select";
import type { BookingTourChip } from "@/features/bookings/bookings-command-center-types";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "@/features/bookings/bookings-command-center-types";

export const BOOKINGS_TOUR_FILTER_TEST_IDS = {
  root: BOOKINGS_COMMAND_CENTER_TEST_IDS.tourFilter,
} as const;

type BookingsTourFilterProps = {
  readonly chips: readonly BookingTourChip[];
  readonly value: string;
  readonly onValueChange: (tourId: string) => void;
  readonly className?: string;
};

export function BookingsTourFilter({
  chips,
  value,
  onValueChange,
  className,
}: BookingsTourFilterProps) {
  const t = useTranslations("bookings");

  const seedOptions = useMemo((): readonly OperatorSearchableSelectOption[] => {
    return chips.map((chip) => ({
      value: chip.tourId,
      label: chip.tourTitle,
      description: t("tourFilterChipMeta", {
        pending: chip.pendingCount,
        total: chip.totalCount,
      }),
    }));
  }, [chips, t]);

  if (chips.length === 0 && value.trim().length === 0) {
    return null;
  }

  return (
    <div
      className={className}
      data-testid={BOOKINGS_TOUR_FILTER_TEST_IDS.root}
      data-operator-bookings-tour-filter
    >
      <label className="flex min-w-0 flex-col gap-1.5 sm:max-w-md">
        <span className="text-xs font-medium text-muted-foreground">{t("tourFilterLabel")}</span>
        <OperatorTourSelect
          value={value}
          onValueChange={onValueChange}
          allowAll
          allLabel={t("allTours")}
          seedOptions={seedOptions}
          placeholder={t("allTours")}
          searchPlaceholder={t("tourFilterSearchPlaceholder")}
          emptyLabel={t("tourFilterNoResults")}
          loadingLabel={t("tourFilterLoading")}
          ariaLabel={t("tourFilterAria")}
        />
      </label>
    </div>
  );
}
