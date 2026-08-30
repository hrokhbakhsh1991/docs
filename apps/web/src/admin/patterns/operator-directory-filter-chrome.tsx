"use client";

import { Filter, Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type OperatorDirectoryFilterChip = {
  readonly key: string;
  readonly label: string;
  readonly onRemove: () => void;
};

type OperatorDirectoryFilterChromeProps = {
  readonly testId?: string;
  readonly searchTestId?: string;
  readonly filtersToggleTestId?: string;
  readonly filtersPanelTestId?: string;
  readonly activeFiltersTestId?: string;
  readonly searchValue?: string;
  readonly searchPlaceholder?: string;
  readonly onSearchChange?: (value: string) => void;
  readonly filtersDirty?: boolean;
  readonly filtersToggleLabel: string;
  readonly clearAllLabel: string;
  readonly removeFilterAriaLabel: (filter: string) => string;
  readonly activeChips: readonly OperatorDirectoryFilterChip[];
  readonly onClearAll?: () => void;
  readonly filterPanel?: ReactNode;
  readonly className?: string;
};

export function OperatorDirectoryFilterChrome({
  testId,
  searchTestId,
  filtersToggleTestId,
  filtersPanelTestId,
  activeFiltersTestId,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  filtersDirty = false,
  filtersToggleLabel,
  clearAllLabel,
  removeFilterAriaLabel,
  activeChips,
  onClearAll,
  filterPanel,
  className,
}: OperatorDirectoryFilterChromeProps) {
  const showSearch = onSearchChange !== undefined;
  const showFilters = filterPanel !== undefined;

  return (
    <div className={cn("space-y-3", className)} data-testid={testId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {showSearch ? (
          <div className="relative min-w-0 max-w-xl flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid={searchTestId}
              className="ps-9"
              value={searchValue ?? ""}
              placeholder={searchPlaceholder}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        ) : null}

        {showFilters ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2 self-start sm:self-auto"
                data-testid={filtersToggleTestId}
              >
                <Filter className="h-4 w-4" aria-hidden />
                {filtersToggleLabel}
                {filtersDirty ? (
                  <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden />
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(100vw-2rem,20rem)] space-y-4 p-4"
              data-testid={filtersPanelTestId}
            >
              {filterPanel}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {activeChips.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid={activeFiltersTestId}
        >
          {activeChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pe-1">
              <span>{chip.label}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-muted"
                aria-label={removeFilterAriaLabel(chip.label)}
                onClick={chip.onRemove}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
          {onClearAll ? (
            <Button type="button" size="sm" variant="ghost" onClick={onClearAll}>
              {clearAllLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
