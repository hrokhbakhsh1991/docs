import { assertDenaliFinanceWorkspace } from "@app-tour/workspace-denali";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getPrismaAdmin } from "../db/prisma";
import {
  canResolveDevTenantRegistryFallback,
  findTenantById,
} from "../tenant/tenant-registry";

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
  if (canResolveDevTenantRegistryFallback()) {
    const devTenant = findTenantById(tenantId);
    if (devTenant !== null) {
      assertDenaliFinanceWorkspace(devTenant.workspaceType);
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
  assertDenaliFinanceWorkspace(row.workspaceType);
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
