import { PlatformTenantRepository } from "../platform/platform-tenant.repository.ts";
import { TenantSuspendedForLoginError } from "./phone-preflight.errors.ts";

export type TenantLoginStatusResolver = (tenantId: string) => Promise<string | null>;

async function defaultResolveTenantStatus(tenantId: string): Promise<string | null> {
  if (process.env.DATABASE_URL?.trim().length === 0 || process.env.DATABASE_URL === undefined) {
    return null;
  }
  const repository = new PlatformTenantRepository();
  const row = await repository.getById(tenantId);
  return row?.status ?? null;
}

/** Blocks operator OTP login when platform has suspended the tenant. Missing DB row = active (dev static tenants). */
export async function assertTenantActiveForOperatorLogin(
  tenantId: string,
  deps: { resolveStatus?: TenantLoginStatusResolver } = {}
): Promise<void> {
  const resolveStatus = deps.resolveStatus ?? defaultResolveTenantStatus;
  const status = await resolveStatus(tenantId);
  if (status === "suspended" || status === "offboarding") {
    throw new TenantSuspendedForLoginError();
  }
}
