/**
 * Theme module enablement helpers shared by finance workspace gate.
 * Default-when-unset comes from generated workspace finance capability bindings
 * (manifest `workspaceFinance.defaultModuleEnabledWhenUnset`) — not hardcoded workspace ids.
 */

import { isFinanceDefaultEnabledWhenModulesUnset } from "./workspace-finance-bindings.generated.ts";

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
  if (modules.length > 0) {
    return false;
  }
  return isFinanceDefaultEnabledWhenModulesUnset(workspaceType.trim().toLowerCase());
}
