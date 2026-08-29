import type { SelectOption } from "../adapters/platform-primitives";

import { filterPickerItemsByQuery } from "./denali-picker-filter-logic";

/** Native `<select>` is fine for short lists; longer catalogs use searchable combobox. */
export const DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD = 8;

/** Cap rendered listbox rows — full catalog may still load client-side. */
export const DEFAULT_DENALI_SEARCHABLE_SELECT_MAX_VISIBLE = 50;

export function shouldUseDenaliSearchableSelect(
  optionCount: number,
  threshold: number = DEFAULT_DENALI_SEARCHABLE_SELECT_THRESHOLD
): boolean {
  return optionCount > threshold;
}

export type FilterSelectOptionsByQueryInput = {
  readonly maxVisible?: number;
  readonly pinnedValue?: string;
  /** When true, empty search shows no browse list (type-to-search). */
  readonly requireQuery?: boolean;
};

function capSelectOptions(
  filtered: readonly SelectOption[],
  maxVisible: number,
  pinnedValue: string,
  allOptions: readonly SelectOption[]
): readonly SelectOption[] {
  if (filtered.length <= maxVisible) {
    return filtered;
  }
  const slice = filtered.slice(0, maxVisible);
  if (pinnedValue.length === 0 || slice.some((option) => option.value === pinnedValue)) {
    return slice;
  }
  const pinned = allOptions.find((option) => option.value === pinnedValue);
  if (pinned === undefined) {
    return slice;
  }
  return [pinned, ...slice.slice(0, Math.max(0, maxVisible - 1))];
}

export function filterSelectOptionsByQuery(
  options: readonly SelectOption[],
  query: string,
  input?: FilterSelectOptionsByQueryInput
): readonly SelectOption[] {
  const normalized = query.trim().toLowerCase();
  const maxVisible = input?.maxVisible ?? DEFAULT_DENALI_SEARCHABLE_SELECT_MAX_VISIBLE;
  const pinnedValue = input?.pinnedValue?.trim() ?? "";
  const requireQuery = input?.requireQuery ?? false;

  let filtered: readonly SelectOption[];
  if (normalized.length === 0) {
    if (requireQuery) {
      filtered =
        pinnedValue.length > 0
          ? options.filter((option) => option.value === pinnedValue)
          : [];
    } else {
      filtered = options;
    }
  } else {
    filtered = filterPickerItemsByQuery(options, query, (option) => option.label);
  }

  return capSelectOptions(filtered, maxVisible, pinnedValue, options);
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
