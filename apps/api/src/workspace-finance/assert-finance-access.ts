import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import {
  isFinanceModuleEnabled,
  parseEnabledModulesFromTheme,
} from "./finance-module-enabled.ts";
import { resolveFinanceTenantWorkspaceRow } from "./resolve-finance-workspace-type-for-tenant.ts";
import { isFinanceSupportedWorkspace } from "./workspace-finance-bindings.generated.ts";

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
  const row = await resolveFinanceTenantWorkspaceRow(tenantId);
  if (row === null) {
    throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
  }
  const workspaceType = row.workspaceType.trim().toLowerCase();
  if (workspaceType.length === 0 || !isFinanceSupportedWorkspace(workspaceType)) {
    throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
  }
  if (!isFinanceModuleEnabled(row.theme, workspaceType)) {
    throw new Error("FORBIDDEN_FINANCE_MODULE_DISABLED");
  }
  return row;
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
