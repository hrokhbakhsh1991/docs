export type {
  TenantUsersListCursor,
  TenantUsersListQuery,
  TenantUsersListRow,
} from "../../domain/tenant-users-list.types";

import type { TenantUsersListQuery, TenantUsersListRow } from "../../domain/tenant-users-list.types";

/**
 * **Persistence only** — workspace user directory listing query.
 * Services own cursor encoding, DTO mapping, and authorization gates.
 */
export interface IUsersListRepository {
  listTenantUsers(_query: TenantUsersListQuery): Promise<TenantUsersListRow[]>;
}
