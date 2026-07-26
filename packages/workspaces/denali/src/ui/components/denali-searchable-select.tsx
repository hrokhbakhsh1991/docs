"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { SelectOption } from "../adapters/platform-primitives";
import { Input, Select } from "../adapters/platform-primitives";
import {
  DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD,
  filterSelectOptionsByQuery,
  resolveSelectOptionLabel,
  shouldUseDenaliSearchableSelect,
} from "../logic/denali-searchable-select-logic";
import { cn } from "../utils/cn";

export const DENALI_SEARCHABLE_SELECT_TEST_IDS = {
  root: "denali-searchable-select",
  trigger: "denali-searchable-select-trigger",
  panel: "denali-searchable-select-panel",
  search: "denali-searchable-select-search",
  option: (value: string) => `denali-searchable-select-option-${value}`,
} as const;

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
  readonly className?: string;
  readonly testId?: string;
  readonly searchableThreshold?: number;
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
  className,
  testId = DENALI_SEARCHABLE_SELECT_TEST_IDS.root,
  searchableThreshold = DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD,
}: DenaliSearchableSelectProps) {
  const reactId = useId();
  const fieldId = id ?? `denali-searchable-select-${reactId.replace(/:/g, "")}`;
  const listboxId = `${fieldId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const ignoreNextTriggerOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isDisabled = disabled || loading;
  const useSearchable = shouldUseDenaliSearchableSelect(options.length, searchableThreshold);
  const selectedLabel = resolveSelectOptionLabel(options, value);
  const filteredOptions = useMemo(
    () => filterSelectOptionsByQuery(options, searchQuery),
    [options, searchQuery]
  );

  const closePanel = () => {
    setOpen(false);
    setSearchQuery("");
  };

  const selectOption = (nextValue: string) => {
    ignoreNextTriggerOpenRef.current = true;
    onChange(nextValue);
    closePanel();
  };

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
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    searchRef.current?.focus();
  }, [open]);

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
      {open ? (
        <div
          className="denali-searchable-select__panel"
          data-testid={DENALI_SEARCHABLE_SELECT_TEST_IDS.panel}
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
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchLabel}
              data-testid={DENALI_SEARCHABLE_SELECT_TEST_IDS.search}
            />
          </label>
          {filteredOptions.length === 0 ? (
            <p className="denali-wizard-composite__status">{searchEmptyMessage}</p>
          ) : (
            <div className="denali-wizard-picker__scroll">
              <ul
                id={listboxId}
                className="denali-searchable-select__list"
                role="listbox"
                aria-label={ariaLabel}
              >
                {filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <li key={option.value} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          "denali-searchable-select__option",
                          isSelected && "denali-searchable-select__option--selected"
                        )}
                        data-testid={DENALI_SEARCHABLE_SELECT_TEST_IDS.option(option.value)}
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
          )}
        </div>
      ) : null}
    </div>
  );
}
