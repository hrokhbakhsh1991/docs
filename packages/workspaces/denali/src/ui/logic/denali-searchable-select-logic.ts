import type { SelectOption } from "../adapters/platform-primitives";

import { filterPickerItemsByQuery } from "./denali-picker-filter-logic";

/** Native `<select>` is fine for short lists; longer catalogs use searchable combobox. */
export const DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD = 8;

export function shouldUseDenaliSearchableSelect(
  optionCount: number,
  threshold: number = DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD
): boolean {
  return optionCount > threshold;
}

export function filterSelectOptionsByQuery(
  options: readonly SelectOption[],
  query: string
): readonly SelectOption[] {
  return filterPickerItemsByQuery(options, query, (option) => option.label);
}

export function resolveSelectOptionLabel(
  options: readonly SelectOption[],
  value: string
): string | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }
  return options.find((option) => option.value === value)?.label;
}
