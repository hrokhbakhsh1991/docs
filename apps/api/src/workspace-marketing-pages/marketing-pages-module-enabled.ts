import {
  isMarketingPagesDefaultEnabledWhenModulesUnset,
  isMarketingPagesSupportedWorkspace,
  resolveMarketingPagesAllowedKeys,
} from "./workspace-marketing-pages-bindings.generated.ts";
import { resolveRegisteredTenantById } from "../tenant/resolve-registered-tenant";
import {
  TENANT_REGISTRY_ADMIN_REASON,
  findTenantFinanceWorkspaceRow,
} from "../tenant/tenant-registry-admin.port";

export const MARKETING_PAGES_WORKSPACE_UNSUPPORTED =
  "MARKETING_PAGES_WORKSPACE_UNSUPPORTED" as const;
export const FORBIDDEN_MARKETING_PAGES_MODULE_DISABLED =
  "FORBIDDEN_MARKETING_PAGES_MODULE_DISABLED" as const;
export const MARKETING_PAGE_KEY_NOT_ALLOWED = "MARKETING_PAGE_KEY_NOT_ALLOWED" as const;

function parseEnabledModulesFromTheme(theme: unknown): readonly string[] | null {
  if (theme === null || typeof theme !== "object" || Array.isArray(theme)) {
    return null;
  }
  const modules = (theme as { modules?: unknown }).modules;
  if (!Array.isArray(modules)) {
    return null;
  }
  return modules.filter((entry): entry is string => typeof entry === "string");
}

export function isMarketingPagesModuleEnabled(theme: unknown, workspaceType: string): boolean {
  const normalized = workspaceType.trim().toLowerCase();
  if (!isMarketingPagesSupportedWorkspace(normalized)) {
    return false;
  }
  const enabledModules = parseEnabledModulesFromTheme(theme);
  if (enabledModules === null) {
    return isMarketingPagesDefaultEnabledWhenModulesUnset(normalized);
  }
  return enabledModules.includes("marketing_pages");
}

async function resolveMarketingPagesTenantWorkspaceRow(tenantId: string): Promise<{
  readonly workspaceType: string;
  readonly theme: unknown;
} | null> {
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
      // Postgres unavailable — fall back to static registry.
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

export async function assertMarketingPagesWorkspaceGate(tenantId: string): Promise<{
  readonly workspaceType: string;
  readonly theme: unknown;
}> {
  const row = await resolveMarketingPagesTenantWorkspaceRow(tenantId);
  if (row === null) {
    throw new Error(MARKETING_PAGES_WORKSPACE_UNSUPPORTED);
  }
  const workspaceType = row.workspaceType.trim().toLowerCase();
  if (!isMarketingPagesSupportedWorkspace(workspaceType)) {
    throw new Error(MARKETING_PAGES_WORKSPACE_UNSUPPORTED);
  }
  if (!isMarketingPagesModuleEnabled(row.theme, workspaceType)) {
    throw new Error(FORBIDDEN_MARKETING_PAGES_MODULE_DISABLED);
  }
  return row;
}

export function assertMarketingPageKeyAllowed(workspaceType: string, pageKey: string): void {
  const allowed = resolveMarketingPagesAllowedKeys(workspaceType);
  if (!allowed.includes(pageKey)) {
    throw new Error(MARKETING_PAGE_KEY_NOT_ALLOWED);
  }
}
