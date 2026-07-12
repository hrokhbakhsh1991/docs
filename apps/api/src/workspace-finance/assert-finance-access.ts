import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getPrismaAdmin } from "../db/prisma";
import { resolveRegisteredTenantById } from "../tenant/resolve-registered-tenant";
import {
  isFinanceModuleEnabled,
  parseEnabledModulesFromTheme,
} from "./finance-module-enabled.ts";
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
  const row = await resolveFinanceTenantGateRow(tenantId);
  if (row === null) {
    throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
  }
  if (!isFinanceSupportedWorkspace(row.workspaceType)) {
    throw new Error("FINANCE_WORKSPACE_UNSUPPORTED");
  }
  if (!isFinanceModuleEnabled(row.theme, row.workspaceType)) {
    throw new Error("FORBIDDEN_FINANCE_MODULE_DISABLED");
  }
  return row;
}

async function resolveFinanceTenantGateRow(
  tenantId: string
): Promise<{ readonly workspaceType: string; readonly theme: unknown } | null> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const row = await getPrismaAdmin().tenant.findUnique({
        where: { id: tenantId },
        select: { workspaceType: true, theme: true },
      });
      if (row !== null) {
        return row;
      }
    } catch {
      // Postgres unavailable — fall back to static registry (dev/test smoke).
    }
  }

  const registered = await resolveRegisteredTenantById(tenantId);
  if (registered === null) {
    return null;
  }
  return {
    workspaceType: registered.workspaceType,
    theme: registered.theme,
  };
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
