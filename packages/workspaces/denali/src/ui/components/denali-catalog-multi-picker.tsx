"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Input } from "../adapters/platform-primitives";
import { CheckIcon } from "../components/icons/tour-service-icons";
import { filterPickerItemsByQuery } from "../logic/denali-picker-filter-logic";
import {
  partitionCatalogChipPreview,
  resolveDenaliCatalogPickerDefaultExpanded,
  truncateCatalogChipLabel,
} from "../logic/denali-catalog-picker-logic";
import { DENALI_CATALOG_MULTI_PICKER_TEST_IDS } from "../test-ids/denali-catalog-multi-picker-test-ids";

export { DENALI_CATALOG_MULTI_PICKER_TEST_IDS } from "../test-ids/denali-catalog-multi-picker-test-ids";

export type DenaliCatalogMultiPickerItem = {
  readonly id: string;
  readonly label: string;
  readonly subtitle?: string;
  readonly searchText?: string;
};

export type DenaliCatalogMultiPickerLabels = {
  readonly collapsePicker: string;
  readonly expandPicker: string;
  readonly selectedCount: (count: number) => string;
  readonly overflowCount: (count: number) => string;
  readonly removeItem: (name: string) => string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly searchEmpty: string;
};

type DenaliCatalogMultiPickerProps = {
  readonly label: string;
  readonly selectedIds: readonly string[];
  readonly items: readonly DenaliCatalogMultiPickerItem[];
  readonly onToggle: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly labels: DenaliCatalogMultiPickerLabels;
  readonly testId?: string;
  readonly dataAttribute?: string;
  readonly renderItemLeading?: (item: DenaliCatalogMultiPickerItem) => ReactNode;
  readonly renderChipLeading?: (item: DenaliCatalogMultiPickerItem) => ReactNode;
};

function ChevronDownIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DenaliCatalogMultiPicker({
  label,
  selectedIds,
  items,
  onToggle,
  onRemove,
  labels,
  testId = DENALI_CATALOG_MULTI_PICKER_TEST_IDS.root,
  dataAttribute = "data-operator-catalog-multi-picker",
  renderItemLeading,
  renderChipLeading,
}: DenaliCatalogMultiPickerProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pickerExpanded, setPickerExpanded] = useState(() =>
    resolveDenaliCatalogPickerDefaultExpanded(selectedIds.length)
  );

  useEffect(() => {
    if (selectedIds.length === 0) {
      setPickerExpanded(true);
    }
  }, [selectedIds.length]);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item] as const)), [items]);

  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((id) => itemById.get(id))
        .filter((item): item is DenaliCatalogMultiPickerItem => item != null),
    [selectedIds, itemById]
  );

  const chipPreview = useMemo(() => partitionCatalogChipPreview(selectedItems), [selectedItems]);

  const filteredItems = useMemo(
    () =>
      filterPickerItemsByQuery(items, searchQuery, (item) =>
        item.searchText ?? [item.label, item.subtitle].filter(Boolean).join(" ")
      ),
    [items, searchQuery]
  );

  const showCollapsedSummary = selectedIds.length > 0 && !pickerExpanded;

  return (
    <div
      className="denali-catalog-multi-picker"
      data-testid={testId}
      {...{ [dataAttribute]: "" }}
      data-operator-catalog-multi-picker-expanded={pickerExpanded ? "true" : "false"}
    >
      <div className="denali-catalog-multi-picker__header-row">
        {selectedIds.length > 0 ? (
          <button
            type="button"
            className="denali-catalog-multi-picker__toggle"
            data-testid={DENALI_CATALOG_MULTI_PICKER_TEST_IDS.toggle}
            aria-expanded={pickerExpanded}
            onClick={() => setPickerExpanded((open) => !open)}
          >
            <span>{pickerExpanded ? labels.collapsePicker : labels.expandPicker}</span>
            <ChevronDownIcon
              className={
                pickerExpanded
                  ? "denali-catalog-multi-picker__toggle-icon denali-catalog-multi-picker__toggle-icon--open"
                  : "denali-catalog-multi-picker__toggle-icon"
              }
            />
          </button>
        ) : null}
      </div>

      {showCollapsedSummary ? (
        <div className="denali-catalog-multi-picker__collapsed" data-testid={DENALI_CATALOG_MULTI_PICKER_TEST_IDS.chips}>
          <div className="denali-catalog-multi-picker__chip-row" role="list" aria-label={label}>
            {chipPreview.visible.map((item) => (
              <span
                key={item.id}
                className="denali-catalog-multi-picker__chip"
                role="listitem"
                data-testid={DENALI_CATALOG_MULTI_PICKER_TEST_IDS.chip}
              >
                {renderChipLeading ? (
                  <span className="denali-catalog-multi-picker__chip-leading" aria-hidden>
                    {renderChipLeading(item)}
                  </span>
                ) : null}
                <span className="denali-catalog-multi-picker__chip-name">
                  {truncateCatalogChipLabel(item.label)}
                </span>
                <button
                  type="button"
                  className="denali-catalog-multi-picker__chip-remove"
                  aria-label={labels.removeItem(item.label)}
                  onClick={() => onRemove(item.id)}
                >
                  ×
                </button>
              </span>
            ))}
            {chipPreview.overflowCount > 0 ? (
              <button
                type="button"
                className="denali-catalog-multi-picker__chip denali-catalog-multi-picker__chip--overflow"
                onClick={() => setPickerExpanded(true)}
              >
                {labels.overflowCount(chipPreview.overflowCount)}
              </button>
            ) : null}
          </div>
          <p className="denali-catalog-multi-picker__summary">
            {labels.selectedCount(selectedIds.length)}
          </p>
        </div>
      ) : null}

      {pickerExpanded && items.length > 0 ? (
        <div className="denali-catalog-multi-picker__panel" data-testid={DENALI_CATALOG_MULTI_PICKER_TEST_IDS.panel}>
          {selectedIds.length > 0 ? (
            <p className="denali-catalog-multi-picker__summary denali-catalog-multi-picker__summary--panel">
              {labels.selectedCount(selectedIds.length)}
            </p>
          ) : null}
          <label className="denali-wizard-picker__search">
            <span className="denali-wizard-picker__search-label">{labels.searchLabel}</span>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              aria-label={labels.searchLabel}
              data-testid={DENALI_CATALOG_MULTI_PICKER_TEST_IDS.search}
            />
          </label>
          {filteredItems.length === 0 ? (
            <p className="denali-wizard-composite__status">{labels.searchEmpty}</p>
          ) : (
            <div className="denali-wizard-picker__scroll">
              <div className="denali-catalog-multi-picker__grid" role="list">
                {filteredItems.map((item) => {
                  const isSelected = selectedSet.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="listitem"
                      data-testid={DENALI_CATALOG_MULTI_PICKER_TEST_IDS.card(item.id)}
                      aria-pressed={isSelected}
                      aria-label={item.label}
                      className={
                        isSelected
                          ? "denali-catalog-multi-picker__card denali-catalog-multi-picker__card--selected"
                          : "denali-catalog-multi-picker__card"
                      }
                      onClick={() => onToggle(item.id)}
                    >
                      {renderItemLeading ? (
                        <span className="denali-catalog-multi-picker__leading" aria-hidden>
                          {renderItemLeading(item)}
                        </span>
                      ) : null}
                      <span className="denali-catalog-multi-picker__body">
                        <span className="denali-catalog-multi-picker__name">{item.label}</span>
                        {item.subtitle ? (
                          <span className="denali-catalog-multi-picker__subtitle">{item.subtitle}</span>
                        ) : null}
                      </span>
                      <span
                        className={
                          isSelected
                            ? "denali-catalog-multi-picker__check denali-catalog-multi-picker__check--visible"
                            : "denali-catalog-multi-picker__check"
                        }
                        aria-hidden
                      >
                        <CheckIcon />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
