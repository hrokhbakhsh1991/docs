"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { parseUrlToQueryModel, serializeQueryModel, type TourListQueryModel } from "./query-model";

const SEARCH_DEBOUNCE_MS = 300;

function mergeQuery(prev: TourListQueryModel, patch: Partial<TourListQueryModel>): TourListQueryModel {
  const merged: TourListQueryModel = {
    ...prev,
    ...patch,
    sort:
      patch.sort !== undefined ? { ...prev.sort, ...patch.sort } : prev.sort,
  };

  const searchChanged =
    patch.search !== undefined && merged.search !== prev.search;
  const statusChanged =
    patch.status !== undefined && merged.status !== prev.status;
  const sortChanged =
    patch.sort !== undefined &&
    (merged.sort.column !== prev.sort.column ||
      merged.sort.dir !== prev.sort.dir);

  if (searchChanged || statusChanged || sortChanged) {
    merged.page = 1;
  } else if (
    patch.search !== undefined &&
    patch.search === prev.search &&
    patch.status === undefined &&
    patch.sort === undefined &&
    patch.limit === undefined
  ) {
    merged.page = prev.page;
  } else if (patch.page !== undefined) {
    merged.page = Math.max(1, patch.page);
  }

  merged.page = Math.max(1, merged.page);
  merged.limit = Math.max(1, merged.limit);

  return merged;
}

function queryEquals(a: TourListQueryModel, b: TourListQueryModel): boolean {
  return (
    a.search === b.search &&
    a.page === b.page &&
    a.limit === b.limit &&
    a.status === b.status &&
    a.sort.column === b.sort.column &&
    a.sort.dir === b.sort.dir
  );
}

export function useToursQueryParams(): {
  query: TourListQueryModel;
  updateQuery: (_patch: Partial<TourListQueryModel>) => void;
  searchInput: string;
  setSearchInput: Dispatch<SetStateAction<string>>;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState<TourListQueryModel>(() =>
    parseUrlToQueryModel(searchParams)
  );
  const [searchInput, setSearchInput] = useState(
    () => parseUrlToQueryModel(searchParams).search
  );

  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const updateQuery = useCallback((patch: Partial<TourListQueryModel>) => {
    setQuery((prev) => {
      const merged = mergeQuery(prev, patch);
      return queryEquals(prev, merged) ? prev : merged;
    });
  }, []);

  useEffect(() => {
    updateQuery({ search: debouncedSearch, page: 1 });
  }, [debouncedSearch, updateQuery]);

  useEffect(() => {
    const qs = serializeQueryModel(query);
    const canonCurrent = serializeQueryModel(parseUrlToQueryModel(searchParams));
    if (qs === canonCurrent) return;
    const href = qs ? `${pathname}?${qs}` : pathname;
    router.replace(href);
  }, [query, pathname, router, searchParams]);

  return {
    query,
    updateQuery,
    searchInput,
    setSearchInput,
  };
}
