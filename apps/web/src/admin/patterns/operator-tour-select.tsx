"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchTourDetailCached } from "@/features/tours/tour-route-cache";

import {
  OperatorSearchableSelect,
  type OperatorSearchableSelectOption,
} from "./operator-searchable-select";
import {
  buildOperatorTourListUrl,
  mapOperatorTourListToSelectItems,
  mapOperatorTourSelectItemsToOptions,
  mergeOperatorTourSelectOptions,
  OPERATOR_TOUR_SELECT_DEFAULT_LIMIT,
  OPERATOR_TOUR_SELECT_SEARCH_DEBOUNCE_MS,
  parseOperatorTourListResponse,
  type OperatorTourSelectItem,
} from "./operator-tour-select-logic";

export const OPERATOR_TOUR_SELECT_TEST_IDS = {
  root: "operator-tour-select",
} as const;

type OperatorTourSelectProps = {
  readonly value: string;
  readonly onValueChange: (tourId: string) => void;
  readonly onTourResolved?: (tour: OperatorTourSelectItem) => void;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly emptyLabel: string;
  readonly loadingLabel: string;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly allowAll?: boolean;
  readonly allLabel?: string;
  readonly seedOptions?: readonly OperatorSearchableSelectOption[];
  readonly formatOptionDescription?: (tour: OperatorTourSelectItem) => string | undefined;
  readonly testId?: string;
};

async function fetchOperatorTourSelectItems(
  search: string
): Promise<readonly OperatorTourSelectItem[]> {
  const response = await fetch(
    buildOperatorTourListUrl({
      search,
      limit: OPERATOR_TOUR_SELECT_DEFAULT_LIMIT,
    }),
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(`TOURS_LIST_HTTP_${response.status}`);
  }
  const payload = parseOperatorTourListResponse(await response.json());
  return payload === null ? [] : mapOperatorTourListToSelectItems(payload.items);
}

export function OperatorTourSelect({
  value,
  onValueChange,
  onTourResolved,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
  ariaLabel,
  className,
  disabled = false,
  allowAll = false,
  allLabel,
  seedOptions = [],
  formatOptionDescription,
  testId = OPERATOR_TOUR_SELECT_TEST_IDS.root,
}: OperatorTourSelectProps) {
  const [remoteItems, setRemoteItems] = useState<readonly OperatorTourSelectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hydratedLabel, setHydratedLabel] = useState<string | null>(null);
  const fetchGenerationRef = useRef(0);

  const remoteOptions = useMemo(
    () => mapOperatorTourSelectItemsToOptions(remoteItems, formatOptionDescription),
    [formatOptionDescription, remoteItems]
  );

  const options = useMemo(() => {
    const allOption: OperatorSearchableSelectOption | null =
      allowAll && allLabel !== undefined
        ? { value: "", label: allLabel }
        : null;
    const merged = mergeOperatorTourSelectOptions(seedOptions, remoteOptions);
    return allOption === null ? merged : [allOption, ...merged];
  }, [allLabel, allowAll, remoteOptions, seedOptions]);

  const loadTours = useCallback(async (search: string) => {
    const generation = fetchGenerationRef.current + 1;
    fetchGenerationRef.current = generation;
    setLoading(true);
    try {
      const items = await fetchOperatorTourSelectItems(search);
      if (fetchGenerationRef.current !== generation) {
        return;
      }
      setRemoteItems(items);
    } catch {
      if (fetchGenerationRef.current === generation) {
        setRemoteItems([]);
      }
    } finally {
      if (fetchGenerationRef.current === generation) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      setHydratedLabel(null);
      return;
    }
    const fromOptions = options.find((option) => option.value === trimmedValue);
    if (fromOptions !== undefined) {
      setHydratedLabel(fromOptions.label);
      return;
    }
    let cancelled = false;
    void fetchTourDetailCached(trimmedValue)
      .then((detail) => {
        if (!cancelled) {
          setHydratedLabel(detail.title);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHydratedLabel(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [options, value]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadTours(searchQuery);
    }, searchQuery.trim().length > 0 ? OPERATOR_TOUR_SELECT_SEARCH_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(handle);
  }, [loadTours, searchQuery]);

  const handleValueChange = (nextValue: string) => {
    onValueChange(nextValue);
    if (nextValue.trim().length === 0) {
      return;
    }
    const fromRemote = remoteItems.find((item) => item.id === nextValue);
    if (fromRemote !== undefined) {
      onTourResolved?.(fromRemote);
      return;
    }
    const fromSeed = seedOptions.find((option) => option.value === nextValue);
    if (fromSeed !== undefined) {
      onTourResolved?.({
        id: fromSeed.value,
        title: fromSeed.label,
        departureAt: null,
      });
    }
  };

  return (
    <div data-testid={testId} data-operator-tour-select>
      <OperatorSearchableSelect
        value={value}
        options={options}
        onValueChange={handleValueChange}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
        loadingLabel={loadingLabel}
        ariaLabel={ariaLabel}
        className={className}
        disabled={disabled}
        loading={loading}
        filterMode="remote"
        onQueryChange={setSearchQuery}
        selectedLabel={hydratedLabel ?? undefined}
      />
    </div>
  );
}
