"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GeocodingSearchResult } from "@/lib/geocoding/nominatim";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LEN = 2;

export type UseDebouncedLocationSearchResult = {
  query: string;
  setQuery: (_value: string) => void;
  results: GeocodingSearchResult[];
  isSearching: boolean;
  searchError: string | null;
  clearResults: () => void;
};

export function useDebouncedLocationSearch(
  initialQuery = "",
): UseDebouncedLocationSearchResult {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GeocodingSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const clearResults = useCallback(() => {
    setResults([]);
    setSearchError(null);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/geocoding/search?q=${encodeURIComponent(trimmed)}`,
            { credentials: "include" },
          );
          if (!res.ok) {
            throw new Error(`search_${res.status}`);
          }
          const body = (await res.json()) as { results?: GeocodingSearchResult[] };
          if (requestId !== requestIdRef.current) {
            return;
          }
          setResults(Array.isArray(body.results) ? body.results : []);
        } catch {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setResults([]);
          setSearchError("search_failed");
        } finally {
          if (requestId === requestIdRef.current) {
            setIsSearching(false);
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return { query, setQuery, results, isSearching, searchError, clearResults };
}
