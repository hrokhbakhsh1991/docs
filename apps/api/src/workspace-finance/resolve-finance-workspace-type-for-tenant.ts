/**
 * Phase 1.5 Commit 1 — tenant → workspaceType for finance composition.
 * Lookup matches the finance gate (Prisma tenant row, then registered-tenant fallback).
 * Registration fail-closed is against the finance dependency registry (not nav/enablement bindings).
 */

import { getPrismaAdmin } from "../db/prisma";
import { resolveRegisteredTenantById } from "../tenant/resolve-registered-tenant";
import { isFinanceDependencyWorkspaceRegistered } from "./finance-dependency-registry";

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
      const row = await getPrismaAdmin().tenant.findUnique({
        where: { id: trimmed },
        select: { workspaceType: true, theme: true },
      });
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
    throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
  }
  const workspaceType = row.workspaceType.trim().toLowerCase();
  if (workspaceType.length === 0 || !isFinanceDependencyWorkspaceRegistered(workspaceType)) {
    throw new Error(
      `FINANCE_WORKSPACE_UNSUPPORTED: workspaceType=${row.workspaceType.trim() || "<empty>"}`
    );
  }
  return workspaceType;
}
