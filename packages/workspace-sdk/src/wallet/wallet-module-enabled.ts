import { WALLET_MODULE_THEME_KEY } from "./wallet-error-codes.js";

export type WalletModuleEnablementBindings = {
  readonly isSupportedWorkspace: (workspaceType: string) => boolean;
  readonly isDefaultEnabledWhenModulesUnset: (workspaceType: string) => boolean;
};

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

/**
 * Theme module enablement for wallet — finance pattern, workspace-agnostic bindings.
 *
 * - `enabledModules` contains `wallet` → enabled
 * - non-empty `enabledModules` without `wallet` → disabled
 * - empty/unset `enabledModules` → `defaultModuleEnabledWhenUnset` from codegen bindings
 */
export function isWalletModuleEnabled(
  theme: unknown,
  workspaceType: string,
  bindings: WalletModuleEnablementBindings,
): boolean {
  const normalized = workspaceType.trim().toLowerCase();
  if (normalized.length === 0 || !bindings.isSupportedWorkspace(normalized)) {
    return false;
  }
  const modules = parseEnabledModulesFromTheme(theme);
  if (modules.includes(WALLET_MODULE_THEME_KEY)) {
    return true;
  }
  if (modules.length > 0) {
    return false;
  }
  return bindings.isDefaultEnabledWhenModulesUnset(normalized);
}
