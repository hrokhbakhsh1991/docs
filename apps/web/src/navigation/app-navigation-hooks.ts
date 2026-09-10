"use client";

import {
  usePathname,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";

const EMPTY_SEARCH_PARAMS = new URLSearchParams();

/**
 * App Router pathname with Pages Router hybrid fallback (pages/_error stub).
 */
export function useAppPathname(): string {
  return usePathname() ?? "";
}

/**
 * App Router search params with Pages Router hybrid fallback (pages/_error stub).
 */
export function useAppSearchParams(): ReadonlyURLSearchParams {
  return useSearchParams() ?? (EMPTY_SEARCH_PARAMS as ReadonlyURLSearchParams);
}
