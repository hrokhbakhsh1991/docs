"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { USERS_DIRECTORY_TEST_IDS } from "@/features/users/users-directory-types";

type UsersDirectoryPaginationProps = {
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
};

export function UsersDirectoryPagination({
  page,
  totalPages,
  total,
  onPageChange,
}: UsersDirectoryPaginationProps) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");

  if (total <= 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid={USERS_DIRECTORY_TEST_IDS.pagination}
    >
      <p className="text-sm text-muted-foreground">
        {t("pagination.summary", { page, totalPages, total })}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {tCommon("previous")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {tCommon("next")}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
