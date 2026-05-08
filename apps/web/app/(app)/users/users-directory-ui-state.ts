import type { RoleFilter, UserSortColumn, UserSortDirection } from "./users-page-logic";

/**
 * User-controlled directory view controls (all client-only today).
 * Shaped so a future `useSearchParams` / `router.replace` can hydrate and persist the same fields.
 *
 * Suggested query mapping later (non-normative): `q` ← searchQuery, `role` ← roleFilter,
 * `sort` ← sortColumn, `order` ← sortDir.
 */
export type DirectoryListUiState = {
  searchQuery: string;
  roleFilter: RoleFilter;
  sortColumn: UserSortColumn;
  sortDir: UserSortDirection;
};

export function createDefaultDirectoryListUiState(): DirectoryListUiState {
  return {
    searchQuery: "",
    roleFilter: "all",
    sortColumn: "name",
    sortDir: "asc",
  };
}
