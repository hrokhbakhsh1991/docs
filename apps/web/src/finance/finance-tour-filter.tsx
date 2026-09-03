"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppPathname, useAppSearchParams } from "@/navigation/app-navigation-hooks";
import { useTranslations } from "next-intl";

import { OperatorTourSelect } from "@/admin/patterns/operator-tour-select";
import type { OperatorSearchableSelectOption } from "@/admin/patterns/operator-searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingsSummaryResponse } from "@/features/bookings/bookings-command-center-types";

export const FINANCE_TOUR_FILTER_TEST_IDS = {
  root: "finance-tour-filter",
  allTours: "finance-tour-filter-all",
} as const;

type FinanceTourFilterProps = {
  readonly className?: string;
};

function parseBookingsSummary(raw: unknown): BookingsSummaryResponse | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const tourChips = Array.isArray(record.tourChips)
    ? record.tourChips
        .map((chip) => {
          if (chip === null || typeof chip !== "object") {
            return null;
          }
          const row = chip as Record<string, unknown>;
          const tourId = String(row.tourId ?? "").trim();
          const tourTitle = String(row.tourTitle ?? "").trim();
          if (tourId.length === 0 || tourTitle.length === 0) {
            return null;
          }
          return {
            tourId,
            tourTitle,
            pendingCount: Number(row.pendingCount ?? 0),
            totalCount: Number(row.totalCount ?? 0),
          };
        })
        .filter((chip): chip is NonNullable<typeof chip> => chip !== null)
    : [];
  return {
    pending: Number(record.pending ?? 0),
    approvedToday: Number(record.approvedToday ?? 0),
    departures7d: Number(record.departures7d ?? 0),
    waitlist: Number(record.waitlist ?? 0),
    tourChips,
  };
}

export function FinanceTourFilter({ className }: FinanceTourFilterProps) {
  const t = useTranslations("finance.commandCenter");
  const searchParams = useAppSearchParams();
  const pathname = useAppPathname();
  const router = useRouter();
  const activeTourId = searchParams.get("tourId")?.trim() ?? "";
  const [loading, setLoading] = useState(true);
  const [tourChips, setTourChips] = useState<BookingsSummaryResponse["tourChips"]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch("/api/bookings/summary", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`BOOKINGS_SUMMARY_HTTP_${response.status}`);
        }
        return parseBookingsSummary(await response.json());
      })
      .then((summary) => {
        if (!cancelled) {
          setTourChips(summary?.tourChips ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTourChips([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const seedOptions = useMemo((): readonly OperatorSearchableSelectOption[] => {
    return tourChips.map((chip) => ({
      value: chip.tourId,
      label: chip.tourTitle,
      description: t("tourFilterChipMeta", {
        pending: chip.pendingCount,
        total: chip.totalCount,
      }),
    }));
  }, [t, tourChips]);

  const replaceTour = (tourId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (tourId.length === 0) {
      next.delete("tourId");
    } else {
      next.set("tourId", tourId);
    }
    const qs = next.toString();
    router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (loading) {
    return (
      <div className={className} data-testid={FINANCE_TOUR_FILTER_TEST_IDS.root}>
        <Skeleton className="h-9 w-full max-w-md" />
      </div>
    );
  }

  if (tourChips.length === 0) {
    return null;
  }

  return (
    <div
      className={className}
      data-testid={FINANCE_TOUR_FILTER_TEST_IDS.root}
      data-operator-finance-tour-filter
    >
      <label className="flex min-w-0 flex-col gap-1.5 sm:max-w-md">
        <span className="text-xs font-medium text-muted-foreground">{t("tourFilterLabel")}</span>
        <OperatorTourSelect
          value={activeTourId}
          onValueChange={replaceTour}
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
