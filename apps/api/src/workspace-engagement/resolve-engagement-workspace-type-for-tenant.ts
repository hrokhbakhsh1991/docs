import { resolveRegisteredTenantById } from "../tenant/resolve-registered-tenant";
import {
  TENANT_REGISTRY_ADMIN_REASON,
  findTenantFinanceWorkspaceRow,
} from "../tenant/tenant-registry-admin.port";

export type EngagementTenantWorkspaceRow = {
  readonly workspaceType: string;
  readonly theme: unknown;
};

export async function resolveEngagementTenantWorkspaceRow(
  tenantId: string,
): Promise<EngagementTenantWorkspaceRow | null> {
  const trimmed = tenantId.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const row = await findTenantFinanceWorkspaceRow(
        trimmed,
        TENANT_REGISTRY_ADMIN_REASON.REGISTRY_RESOLVE_FINANCE_WORKSPACE,
      );
      if (row !== null) {
        return row;
      }
    } catch {
      // Postgres unavailable — fall back to static registry (dev/test smoke).
    }
  }

  const registered = await resolveRegisteredTenantById(trimmed);
  if (registered === null) {
    return null;
  }
  return {
    workspaceType: registered.workspaceType,
    theme: registered.theme,
  };
}
