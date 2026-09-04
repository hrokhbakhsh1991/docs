import { resolveRegisteredTenantById } from "../tenant/resolve-registered-tenant";
import {
  TENANT_REGISTRY_ADMIN_REASON,
  findTenantFinanceWorkspaceRow,
} from "../tenant/tenant-registry-admin.port";
import { TICKETING_WORKSPACE_UNSUPPORTED } from "@app-tour/workspace-sdk/ticketing";

export { TICKETING_WORKSPACE_UNSUPPORTED };

export type TicketingTenantWorkspaceRow = {
  readonly workspaceType: string;
  readonly theme: unknown;
};

export function isTicketingWorkspaceUnsupportedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === TICKETING_WORKSPACE_UNSUPPORTED ||
      error.message.startsWith(`${TICKETING_WORKSPACE_UNSUPPORTED}:`))
  );
}

export async function resolveTicketingTenantWorkspaceRow(
  tenantId: string,
): Promise<TicketingTenantWorkspaceRow | null> {
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
