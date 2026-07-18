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

export function parseEnabledModulesFromTheme(theme: unknown): readonly string[] {
  if (theme === null || typeof theme !== "object") {
    return [];
  }
  const record = theme as Record<string, unknown>;
  const modules = record.enabledModules ?? record.enabled_modules;
  if (!Array.isArray(modules)) {
    return [];
  }
  return modules.filter((entry): entry is string => typeof entry === "string");
}

export function isFinanceModuleEnabled(theme: unknown, workspaceType: string): boolean {
  const modules = parseEnabledModulesFromTheme(theme);
  if (modules.includes("finance")) {
    return true;
  }
  // Denali default: finance on when module list unset (legacy parity).
  return workspaceType === "denali" && modules.length === 0;
}

export async function assertFinanceWorkspaceGate(tenantId: string): Promise<{
  readonly workspaceType: string;
  readonly theme: unknown;
}> {
  const row = await resolveFinanceTenantWorkspaceRow(tenantId);
  if (row === null) {
    throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
  }
  const validFinanceWorkspaces = ["denali"];
  if (!validFinanceWorkspaces.includes(row.workspaceType)) {
    throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
  }
  if (!isFinanceModuleEnabled(row.theme, row.workspaceType)) {
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
