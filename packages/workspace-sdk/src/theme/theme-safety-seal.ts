import { throwWorkspaceValidationError } from "../errors/workspace-validation-errors.js";
import type { TenantThemeConfig } from "./tenant-theme.contract";
import type { WorkspaceThemeContract } from "./workspace-theme.contract";

/** Runtime brand key on sealed workspace themes (frozen value-type seal). */
export const WORKSPACE_THEME_SEAL_KEY = "__workspaceThemeSeal" as const;

/** Runtime brand key on sealed tenant themes (frozen value-type seal). */
export const TENANT_THEME_SEAL_KEY = "__tenantThemeSeal" as const;

/** Workspace theme that passed ingress validation and was sealed for DOM builders. */
export type SealedWorkspaceTheme = WorkspaceThemeContract & {
  readonly [WORKSPACE_THEME_SEAL_KEY]: true;
};

/** Tenant theme that passed {@link validateTenantTheme} and was sealed for DOM builders. */
export type SealedTenantTheme = TenantThemeConfig & {
  readonly [TENANT_THEME_SEAL_KEY]: true;
};

function failUnsealed(kind: "workspace" | "tenant"): never {
  throwWorkspaceValidationError(
    "UNSEALED_THEME",
    `${kind} theme must be validated and sealed before DOM style mapping (use ingress guard or validateTenantTheme)`,
  );
}

function hasWorkspaceSeal(theme: WorkspaceThemeContract): theme is SealedWorkspaceTheme {
  return (
    typeof theme === "object" &&
    theme !== null &&
    WORKSPACE_THEME_SEAL_KEY in theme &&
    (theme as SealedWorkspaceTheme)[WORKSPACE_THEME_SEAL_KEY] === true
  );
}

function hasTenantSeal(theme: TenantThemeConfig): theme is SealedTenantTheme {
  return (
    typeof theme === "object" &&
    theme !== null &&
    TENANT_THEME_SEAL_KEY in theme &&
    (theme as SealedTenantTheme)[TENANT_THEME_SEAL_KEY] === true
  );
}

function freezeWorkspaceTheme(theme: WorkspaceThemeContract): SealedWorkspaceTheme {
  const cssVariables = Object.freeze({ ...theme.cssVariables });
  return Object.freeze({
    id: theme.id,
    version: theme.version,
    cssVariables,
    ...(theme.optionalStylesheet !== undefined
      ? { optionalStylesheet: theme.optionalStylesheet }
      : {}),
    [WORKSPACE_THEME_SEAL_KEY]: true as const,
  }) as SealedWorkspaceTheme;
}

function freezeTenantTheme(theme: TenantThemeConfig): SealedTenantTheme {
  const sealed: Record<string, unknown> = { [TENANT_THEME_SEAL_KEY]: true as const };
  if (theme.primaryColor !== undefined) {
    sealed.primaryColor = theme.primaryColor;
  }
  if (theme.cssVariables !== undefined) {
    sealed.cssVariables = Object.freeze({ ...theme.cssVariables });
  }
  return Object.freeze(sealed) as SealedTenantTheme;
}

/** Returns a branded, frozen workspace theme safe for DOM style mapping (theme-react internal). */
export function sealWorkspaceTheme(theme: WorkspaceThemeContract): SealedWorkspaceTheme {
  if (hasWorkspaceSeal(theme)) {
    return theme;
  }
  return freezeWorkspaceTheme(theme);
}

/** Returns a branded, frozen tenant theme safe for DOM style mapping (theme-react internal). */
export function sealTenantTheme(theme: TenantThemeConfig): SealedTenantTheme {
  if (hasTenantSeal(theme)) {
    return theme;
  }
  return freezeTenantTheme(theme);
}

/** @internal Seal enforced via snapshotWorkspaceTheme / ingress guards only. */
export function assertWorkspaceThemeSealed(
  theme: WorkspaceThemeContract,
): asserts theme is SealedWorkspaceTheme {
  if (!hasWorkspaceSeal(theme)) {
    failUnsealed("workspace");
  }
}

/** @internal Seal enforced via validateTenantTheme only. */
export function assertTenantThemeSealed(theme: TenantThemeConfig): asserts theme is SealedTenantTheme {
  if (!hasTenantSeal(theme)) {
    failUnsealed("tenant");
  }
}
