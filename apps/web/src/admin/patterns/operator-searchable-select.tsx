"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const OPERATOR_SEARCHABLE_SELECT_TEST_IDS = {
  root: "operator-searchable-select",
  trigger: "operator-searchable-select-trigger",
  panel: "operator-searchable-select-panel",
  search: "operator-searchable-select-search",
  option: (value: string) => `operator-searchable-select-option-${value || "all"}`,
} as const;

export type OperatorSearchableSelectOption = {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
};

type OperatorSearchableSelectProps = {
  readonly value: string;
  readonly options: readonly OperatorSearchableSelectOption[];
  readonly onValueChange: (value: string) => void;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly emptyLabel: string;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly loadingLabel?: string;
  readonly filterMode?: "local" | "remote";
  readonly onQueryChange?: (query: string) => void;
  readonly selectedLabel?: string;
};

export function OperatorSearchableSelect({
  value,
  options,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  ariaLabel,
  className,
  disabled = false,
  loading = false,
  loadingLabel,
  filterMode = "local",
  onQueryChange,
  selectedLabel,
}: OperatorSearchableSelectProps) {
  const listboxId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    if (filterMode === "remote") {
      return options;
    }
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length === 0) {
      return options;
    }
    return options.filter((option) => {
      const haystack = `${option.label} ${option.description ?? ""}`.toLocaleLowerCase();
      return haystack.includes(normalized);
    });
  }, [filterMode, options, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  }, [activeIndex, filtered.length]);

  const commitSelection = useCallback(
    (nextValue: string) => {
      onValueChange(nextValue);
      setOpen(false);
    },
    [onValueChange]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={ariaLabel}
          disabled={disabled}
          data-testid={OPERATOR_SEARCHABLE_SELECT_TEST_IDS.trigger}
          data-operator-searchable-select-trigger
          className={cn(
            "h-9 w-full max-w-md justify-between font-normal",
            className
          )}
        >
          <span className="min-w-0 truncate text-start">
            {selected !== null
              ? selected.label
              : selectedLabel !== undefined && value.trim().length > 0
                ? selectedLabel
                : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(24rem,var(--radix-popover-trigger-width))] p-0"
        data-testid={OPERATOR_SEARCHABLE_SELECT_TEST_IDS.panel}
        data-operator-searchable-select-panel
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div
          className="border-b p-2"
          data-testid={OPERATOR_SEARCHABLE_SELECT_TEST_IDS.root}
          data-operator-searchable-select
        >
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              onQueryChange?.(event.target.value);
              setActiveIndex(0);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            data-testid={OPERATOR_SEARCHABLE_SELECT_TEST_IDS.search}
            data-operator-searchable-select-search
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter" && filtered[activeIndex] !== undefined) {
                event.preventDefault();
                commitSelection(filtered[activeIndex]!.value);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              }
            }}
          />
        </div>
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="max-h-60 overflow-y-auto p-1"
        >
          {loading ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {loadingLabel ?? emptyLabel}
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</li>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <li key={option.value || "__all__"} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-testid={OPERATOR_SEARCHABLE_SELECT_TEST_IDS.option(option.value)}
                    data-operator-searchable-select-option={option.value || "all"}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-2 text-start text-sm transition-colors",
                      isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commitSelection(option.value)}
                  >
                    <Check
                      className={cn("mt-0.5 size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.description !== undefined && option.description.length > 0 ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
