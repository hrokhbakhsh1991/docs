import type { UserTenantEntity } from "../../entities/user-tenant.entity";
import type { TenantScopedUserRow } from "../users-tenant-scope.types";

/**
 * **Persistence only** — tenant-scoped reads on `users` + `user_tenants`.
 * Orchestration, authorization, and DTO mapping stay in application services.
 */
export interface IUsersTenantScopeRepository {
  findTenantScopedUserRow(_tenantId: string, _userId: string): Promise<TenantScopedUserRow | null>;
  findActiveMembership(_tenantId: string, _userId: string): Promise<UserTenantEntity | null>;
}
