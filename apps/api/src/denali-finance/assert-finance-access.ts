import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getPrismaAdmin } from "../db/prisma";
import {
  canResolveDevTenantRegistryFallback,
  findTenantById,
} from "../tenant/tenant-registry";
import {
  isFinanceModuleEnabled,
  parseEnabledModulesFromTheme,
} from "../workspace-finance/finance-module-enabled.ts";
import { isFinanceSupportedWorkspace } from "../workspace-finance/workspace-finance-bindings.generated.ts";

export { parseEnabledModulesFromTheme, isFinanceModuleEnabled };

function isAdminOrOwner(context: TenantAuthContext): boolean {
  return context.role === "admin" || context.role === "owner";
}

function isAuthzGranted(context: TenantAuthContext): boolean {
  if (context.status !== "ACTIVE" || context.role === "none") {
    return false;
  }
  if (context.role === "member") {
    return context.workspaceId !== undefined && context.workspaceId.length > 0;
  }
  return true;
}

export async function assertFinanceWorkspaceGate(tenantId: string): Promise<{
  readonly workspaceType: string;
  readonly theme: unknown;
}> {
  if (canResolveDevTenantRegistryFallback()) {
    const devTenant = findTenantById(tenantId);
    if (devTenant !== null) {
      if (!isFinanceSupportedWorkspace(devTenant.workspaceType)) {
        throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
      }
      if (!isFinanceModuleEnabled(devTenant.theme, devTenant.workspaceType)) {
        throw new Error("FORBIDDEN_FINANCE_MODULE_DISABLED");
      }
      return { workspaceType: devTenant.workspaceType, theme: devTenant.theme };
    }
  }

  const row = await getPrismaAdmin().tenant.findUnique({
    where: { id: tenantId },
    select: { workspaceType: true, theme: true },
  });
  if (row === null) {
    throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
  }
  if (!isFinanceSupportedWorkspace(row.workspaceType)) {
    throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
  }
  if (!isFinanceModuleEnabled(row.theme, row.workspaceType)) {
    throw new Error("FORBIDDEN_FINANCE_MODULE_DISABLED");
  }
  return { workspaceType: row.workspaceType, theme: row.theme };
}

export function assertFinanceOperatorAccess(auth: TenantAuthContext): void {
  if (!isAuthzGranted(auth) || !isAdminOrOwner(auth)) {
    throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
  }
}

export function assertFinanceReceiptSubmitAccess(auth: TenantAuthContext): void {
  if (!isAuthzGranted(auth)) {
    throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
  }
  if (!isAdminOrOwner(auth) && auth.role !== "member") {
    throw new Error("FORBIDDEN_OPERATOR_FORBIDDEN");
  }
}
