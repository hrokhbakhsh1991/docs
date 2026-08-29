"use client";

import { Filter, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { USERS_DIRECTORY_SORT_OPTIONS } from "@/features/users/users-directory-list-logic";
import {
  USERS_DIRECTORY_TEST_IDS,
  type UsersDirectoryQuery,
  type UsersDirectoryRole,
  type UsersDirectoryStatus,
} from "@/features/users/users-directory-types";

const ROLE_FILTER_OPTIONS = ["all", "owner", "admin", "member", "viewer"] as const;
const STATUS_FILTER_OPTIONS = ["all", "active", "suspended"] as const;

type UsersDirectoryControlsProps = {
  readonly query: UsersDirectoryQuery;
  readonly searchInput: string;
  readonly onSearchInputChange: (value: string) => void;
  readonly onQueryChange: (next: UsersDirectoryQuery) => void;
};

export function UsersDirectoryControls({
  query,
  searchInput,
  onSearchInputChange,
  onQueryChange,
}: UsersDirectoryControlsProps) {
  const t = useTranslations("users");

  const filtersDirty =
    query.role !== "all" || query.status !== "all" || query.sort !== "name_asc";

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (query.role !== "all") {
      chips.push({
        key: "role",
        label: t("activeFilters.role", { value: t(`roles.${query.role}`) }),
        onRemove: () => onQueryChange({ ...query, role: "all", page: 1 }),
      });
    }
    if (query.status !== "all") {
      chips.push({
        key: "status",
        label: t("activeFilters.status", { value: t(`statusFilter.${query.status}`) }),
        onRemove: () => onQueryChange({ ...query, status: "all", page: 1 }),
      });
    }
    if (query.sort !== "name_asc") {
      chips.push({
        key: "sort",
        label: t("activeFilters.sort", { value: t(`sort.${query.sort}`) }),
        onRemove: () => onQueryChange({ ...query, sort: "name_asc", page: 1 }),
      });
    }
    return chips;
  }, [onQueryChange, query, t]);

  const patchQuery = (patch: Partial<UsersDirectoryQuery>) => {
    onQueryChange({ ...query, ...patch, page: 1 });
  };

  return (
    <div className="space-y-3" data-testid={USERS_DIRECTORY_TEST_IDS.controls}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 max-w-xl flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid={USERS_DIRECTORY_TEST_IDS.search}
            className="ps-9"
            value={searchInput}
            placeholder={t("searchPlaceholder")}
            onChange={(event) => onSearchInputChange(event.target.value)}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2 self-start sm:self-auto"
              data-testid={USERS_DIRECTORY_TEST_IDS.filtersToggle}
            >
              <Filter className="h-4 w-4" aria-hidden />
              {t("filters.toggle")}
              {filtersDirty ? (
                <span
                  className="inline-block size-1.5 rounded-full bg-primary"
                  aria-hidden
                />
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[min(100vw-2rem,20rem)] space-y-4 p-4"
            data-testid={USERS_DIRECTORY_TEST_IDS.filtersPanel}
          >
            <div className="space-y-2" data-testid={USERS_DIRECTORY_TEST_IDS.roleFilter}>
              <Label htmlFor="users-filter-role">{t("filters.roleLabel")}</Label>
              <select
                id="users-filter-role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={query.role}
                onChange={(event) =>
                  patchQuery({ role: event.target.value as UsersDirectoryRole })
                }
              >
                {ROLE_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`roles.${option}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2" data-testid={USERS_DIRECTORY_TEST_IDS.statusFilter}>
              <Label htmlFor="users-filter-status">{t("filters.statusLabel")}</Label>
              <select
                id="users-filter-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={query.status}
                onChange={(event) =>
                  patchQuery({ status: event.target.value as UsersDirectoryStatus })
                }
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`statusFilter.${option}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2" data-testid={USERS_DIRECTORY_TEST_IDS.sortFilter}>
              <Label htmlFor="users-filter-sort">{t("filters.sortLabel")}</Label>
              <select
                id="users-filter-sort"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={query.sort}
                onChange={(event) =>
                  patchQuery({
                    sort: event.target.value as UsersDirectoryQuery["sort"],
                  })
                }
              >
                {USERS_DIRECTORY_SORT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`sort.${option}`)}
                  </option>
                ))}
              </select>
            </div>

            {filtersDirty ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() =>
                  onQueryChange({
                    ...query,
                    role: "all",
                    status: "all",
                    sort: "name_asc",
                    page: 1,
                  })
                }
              >
                {t("filters.clearAll")}
              </Button>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>

      {activeChips.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid={USERS_DIRECTORY_TEST_IDS.activeFilters}
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              onQueryChange({
                ...query,
                role: "all",
                status: "all",
                sort: "name_asc",
                page: 1,
              })
            }
          >
            {t("filters.clearAll")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
