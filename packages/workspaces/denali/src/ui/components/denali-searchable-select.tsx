"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import type { SelectOption } from "../adapters/platform-primitives";
import { Input, Select } from "../adapters/platform-primitives";
import {
  DEFAULT_DENALI_SEARCHABLE_SELECT_MAX_VISIBLE,
  DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD,
  filterSelectOptionsByQuery,
  resolveSelectOptionLabel,
  shouldUseDenaliSearchableSelect,
} from "../logic/denali-searchable-select-logic";
import { DENALI_SEARCHABLE_SELECT_TEST_IDS } from "../test-ids/denali-searchable-select-test-ids";
import { cn } from "../utils/cn";

export { DENALI_SEARCHABLE_SELECT_TEST_IDS } from "../test-ids/denali-searchable-select-test-ids";

const DENALI_SEARCHABLE_SELECT_PANEL_CLOSE_MS = 140;

function ChevronDownIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export type DenaliSearchableSelectProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly invalid?: boolean;
  readonly ariaLabel: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly searchEmptyMessage: string;
  /** Shown when requireQueryToBrowse and search is empty. Defaults to searchPlaceholder. */
  readonly searchPromptMessage?: string;
  readonly className?: string;
  readonly testId?: string;
  readonly searchableThreshold?: number;
  /** When true, list stays empty until operator types (selected value may still hydrate). */
  readonly requireQueryToBrowse?: boolean;
  /** Max options rendered in the listbox. */
  readonly maxVisibleOptions?: number;
};

export function DenaliSearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  loading = false,
  disabled = false,
  required = false,
  invalid = false,
  ariaLabel,
  searchLabel,
  searchPlaceholder,
  searchEmptyMessage,
  searchPromptMessage,
  className,
  testId = DENALI_SEARCHABLE_SELECT_TEST_IDS.root,
  searchableThreshold = DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD,
  requireQueryToBrowse = false,
  maxVisibleOptions = DEFAULT_DENALI_SEARCHABLE_SELECT_MAX_VISIBLE,
}: DenaliSearchableSelectProps) {
  const reactId = useId();
  const fieldId = id ?? `denali-searchable-select-${reactId.replace(/:/g, "")}`;
  const listboxId = `${fieldId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const ignoreNextTriggerOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelState, setPanelState] = useState<"open" | "closed">("closed");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const isDisabled = disabled || loading;
  const useSearchable = shouldUseDenaliSearchableSelect(options.length, searchableThreshold);
  const selectedLabel = resolveSelectOptionLabel(options, value);
  const filteredOptions = useMemo(
    () =>
      filterSelectOptionsByQuery(options, searchQuery, {
        maxVisible: maxVisibleOptions,
        pinnedValue: value,
        requireQuery: requireQueryToBrowse,
      }),
    [maxVisibleOptions, options, requireQueryToBrowse, searchQuery, value]
  );

  const showSearchPrompt =
    requireQueryToBrowse && searchQuery.trim().length === 0 && filteredOptions.length === 0;
  const showNoResults =
    !showSearchPrompt && searchQuery.trim().length > 0 && filteredOptions.length === 0;

  const closePanel = useCallback(() => {
    setOpen(false);
    setSearchQuery("");
    setActiveIndex(-1);
  }, []);

  const selectOption = useCallback(
    (nextValue: string) => {
      ignoreNextTriggerOpenRef.current = true;
      onChange(nextValue);
      closePanel();
    },
    [closePanel, onChange]
  );

  useEffect(() => {
    if (open) {
      setPanelMounted(true);
      setPanelState("open");
      return;
    }
    if (!panelMounted) {
      return;
    }
    setPanelState("closed");
    const timeoutId = window.setTimeout(() => {
      setPanelMounted(false);
    }, DENALI_SEARCHABLE_SELECT_PANEL_CLOSE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [open, panelMounted]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root == null) {
        return;
      }
      const path = event.composedPath();
      if (path.some((node) => node === root)) {
        return;
      }
      closePanel();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePanel, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) {
      return;
    }
    const item = listRef.current?.children.item(activeIndex);
    if (item instanceof HTMLElement) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filteredOptions.length === 0) {
        return;
      }
      setActiveIndex((current) => (current + 1) % filteredOptions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filteredOptions.length === 0) {
        return;
      }
      setActiveIndex((current) =>
        current <= 0 ? filteredOptions.length - 1 : current - 1
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const picked = filteredOptions[activeIndex] ?? filteredOptions[0];
      if (picked) {
        selectOption(picked.value);
      }
    }
  };

  if (!useSearchable) {
    return (
      <Select
        id={fieldId}
        data-testid={testId}
        className={className}
        aria-label={ariaLabel}
        options={options}
        value={value}
        placeholder={loading ? placeholder : placeholder}
        required={required}
        invalid={invalid}
        disabled={isDisabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn("denali-searchable-select", className)}
      data-testid={testId}
      data-operator-searchable-select
      data-open={open ? "true" : "false"}
    >
      <button
        id={fieldId}
        type="button"
        className={cn(
          "denali-searchable-select__trigger",
          !selectedLabel && "denali-searchable-select__trigger--placeholder",
          invalid && "denali-searchable-select__trigger--invalid"
        )}
        data-testid={DENALI_SEARCHABLE_SELECT_TEST_IDS.trigger}
        role="combobox"
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) {
            return;
          }
          if (ignoreNextTriggerOpenRef.current) {
            ignoreNextTriggerOpenRef.current = false;
            return;
          }
          setOpen((current) => {
            if (current) {
              setSearchQuery("");
              setActiveIndex(-1);
            }
            return !current;
          });
        }}
      >
        <span className="denali-searchable-select__trigger-label">
          {loading ? placeholder : selectedLabel ?? placeholder}
        </span>
        <ChevronDownIcon className="denali-searchable-select__trigger-icon" />
      </button>
      {panelMounted ? (
        <div
          className="denali-searchable-select__panel"
          data-testid={DENALI_SEARCHABLE_SELECT_TEST_IDS.panel}
          data-operator-searchable-select-panel
          data-state={panelState}
          data-side="bottom"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <label className="denali-wizard-picker__search">
            <span className="denali-wizard-picker__search-label">{searchLabel}</span>
            <Input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchLabel}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={
                activeIndex >= 0 && filteredOptions[activeIndex]
                  ? `${fieldId}-option-${filteredOptions[activeIndex]!.value}`
                  : undefined
              }
              data-testid={DENALI_SEARCHABLE_SELECT_TEST_IDS.search}
            />
          </label>
          {showSearchPrompt ? (
            <p className="denali-wizard-composite__status">
              {searchPromptMessage ?? searchPlaceholder}
            </p>
          ) : null}
          {showNoResults ? (
            <p className="denali-wizard-composite__status">{searchEmptyMessage}</p>
          ) : null}
          {!showSearchPrompt && !showNoResults && filteredOptions.length > 0 ? (
            <div className="denali-wizard-picker__scroll">
              <ul
                ref={listRef}
                id={listboxId}
                className="denali-searchable-select__list"
                role="listbox"
                aria-label={ariaLabel}
              >
                {filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;
                  return (
                    <li key={option.value} role="presentation">
                      <button
                        type="button"
                        id={`${fieldId}-option-${option.value}`}
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          "denali-searchable-select__option",
                          isSelected && "denali-searchable-select__option--selected",
                          isActive && "denali-searchable-select__option--active"
                        )}
                        data-testid={DENALI_SEARCHABLE_SELECT_TEST_IDS.option(option.value)}
                        onMouseEnter={() => setActiveIndex(index)}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          selectOption(option.value);
                        }}
                      >
                        {option.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
