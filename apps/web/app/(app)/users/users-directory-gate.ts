/**
 * Single source of truth for /users body branching order (must stay aligned with access rules).
 *
 * 1) Hydrate session when API URL exists
 * 2) Signed out
 * 3) Leader-only directory
 * 4) No backend URL → unavailable (not “empty list”)
 * 5) Fetching list
 * 6) Fetch failed
 * 7) Successful empty tenant roster
 * 8) Directory with rows (incl. in-table “no search matches”)
 */

import { ApiError } from "@/lib/api-client";

import { USERS_ROUTE_COPY } from "./users-copy";

const copy = USERS_ROUTE_COPY.list;

export type UsersDirectoryBodyState =
  | { type: "hydrating-session" }
  | { type: "sign-in" }
  | { type: "leader-denied" }
  | { type: "api-unavailable" }
  | { type: "list-loading" }
  | { type: "list-error"; error: unknown }
  | { type: "list-empty" }
  | { type: "directory" };

export type UsersDirectoryGateInput = {
  isHydrated: boolean;
  isAuthenticated: boolean;
  leader: boolean;
  liveApi: boolean;
  usersLoading: boolean;
  isError: boolean;
  error: unknown;
  usersLength: number;
  hasActiveFilters: boolean;
};

export function resolveUsersDirectoryBodyState(input: UsersDirectoryGateInput): UsersDirectoryBodyState {
  const {
    isHydrated,
    isAuthenticated,
    leader,
    liveApi,
    usersLoading,
    isError,
    error,
    usersLength,
    hasActiveFilters
  } = input;

  if (!isHydrated && liveApi) {
    return { type: "hydrating-session" };
  }
  if (!isAuthenticated) {
    return { type: "sign-in" };
  }
  if (!leader) {
    return { type: "leader-denied" };
  }
  if (!liveApi) {
    return { type: "api-unavailable" };
  }
  if (usersLoading) {
    return { type: "list-loading" };
  }
  if (isError) {
    return { type: "list-error", error };
  }
  // Keep directory shell (toolbar/search/filter) visible for "no results" states.
  if (usersLength === 0 && !hasActiveFilters) {
    return { type: "list-empty" };
  }
  return { type: "directory" };
}

export function usersListErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return copy.loadError403;
    return error.message.trim() || copy.loadErrorFallback;
  }
  return copy.loadErrorFallback;
}

export function usersListErrorTitle(error: unknown): string {
  return error instanceof ApiError && error.status === 403 ? copy.loadErrorAccessTitle : copy.loadErrorTitle;
}
