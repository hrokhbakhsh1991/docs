import type { UserTenantEntity } from "../../entities/user-tenant.entity";
import type { TenantScopedUserRow } from "../users-tenant-scope.types";

/**
 * **Persistence only** — tenant-scoped reads on `users` + `user_tenants`.
 * Orchestration, authorization, and DTO mapping stay in application services.
 */
export interface IUsersTenantScopeRepository {
  findTenantScopedUserRow(tenantId: string, userId: string): Promise<TenantScopedUserRow | null>;
  findActiveMembership(tenantId: string, userId: string): Promise<UserTenantEntity | null>;
}
