/**
 * Phase 1.5 Commit 1 — tenant → workspaceType for finance composition.
 * Lookup matches the finance gate (Prisma tenant row, then registered-tenant fallback).
 * Registration fail-closed is against the finance dependency registry (not nav/enablement bindings).
 *
 * Postgres path uses {@link findTenantFinanceWorkspaceRow} (PSR-5d) so raw theme JSON
 * (enabledModules) is preserved — branding merge via resolveRegisteredTenantById would drop it.
 */

import { resolveRegisteredTenantById } from "../tenant/resolve-registered-tenant";
import {
  TENANT_REGISTRY_ADMIN_REASON,
  findTenantFinanceWorkspaceRow,
} from "../tenant/tenant-registry-admin.port";
import { isFinanceDependencyWorkspaceRegistered } from "./finance-dependency-registry";

/** Stable HTTP / domain code — never echo `workspaceType=` diagnostics to clients. */
export const FINANCE_WORKSPACE_UNSUPPORTED = "FINANCE_WORKSPACE_UNSUPPORTED";

/** True when finance composition/gate failed closed for an unsupported or missing tenant. */
export function isFinanceWorkspaceUnsupportedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === FINANCE_WORKSPACE_UNSUPPORTED ||
      error.message.startsWith(`${FINANCE_WORKSPACE_UNSUPPORTED}:`))
  );
}

export type FinanceTenantWorkspaceRow = {
  readonly workspaceType: string;
  readonly theme: unknown;
};

/**
 * Raw tenant finance row (workspaceType + theme). Null when tenant cannot be resolved.
 * Used by {@link assertFinanceWorkspaceGate} and composition.
 */
export async function resolveFinanceTenantWorkspaceRow(
  tenantId: string
): Promise<FinanceTenantWorkspaceRow | null> {
  const trimmed = tenantId.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const row = await findTenantFinanceWorkspaceRow(
        trimmed,
        TENANT_REGISTRY_ADMIN_REASON.REGISTRY_RESOLVE_FINANCE_WORKSPACE
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

/**
 * Resolve workspaceType for finance dependency composition.
 * @throws `FINANCE_WORKSPACE_UNSUPPORTED` when tenant missing or type not in finance registry.
 */
export async function resolveFinanceWorkspaceTypeForTenant(tenantId: string): Promise<string> {
  const row = await resolveFinanceTenantWorkspaceRow(tenantId);
  if (row === null) {
    throw new Error(FINANCE_WORKSPACE_UNSUPPORTED);
  }
  const workspaceType = row.workspaceType.trim().toLowerCase();
  if (workspaceType.length === 0 || !isFinanceDependencyWorkspaceRegistered(workspaceType)) {
    throw new Error(
      `${FINANCE_WORKSPACE_UNSUPPORTED}: workspaceType=${row.workspaceType.trim() || "<empty>"}`
    );
  }
  return workspaceType;
}
