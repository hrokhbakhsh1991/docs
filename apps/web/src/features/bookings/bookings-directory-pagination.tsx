"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "@/features/bookings/bookings-command-center-types";

type BookingsDirectoryPaginationProps = {
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  readonly disabled?: boolean;
};

export function BookingsDirectoryPagination({
  page,
  totalPages,
  total,
  onPageChange,
  disabled = false,
}: BookingsDirectoryPaginationProps) {
  const t = useTranslations("bookings");
  const tCommon = useTranslations("common");

  if (total <= 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-2 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.pagination}
    >
      <p className="text-sm text-muted-foreground">
        {t("pagination.summary", { page, totalPages, total })}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {tCommon("previous")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {tCommon("next")}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
