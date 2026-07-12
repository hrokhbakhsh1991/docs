import {
  isFinanceDefaultEnabledWhenModulesUnset,
} from "./workspace-finance-bindings.generated.ts";

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

/** Theme explicit module list wins; otherwise manifest default for supported workspaces (WAC-001). */
export function isFinanceModuleEnabled(theme: unknown, workspaceType: string): boolean {
  const modules = parseEnabledModulesFromTheme(theme);
  if (modules.includes("finance")) {
    return true;
  }
  return isFinanceDefaultEnabledWhenModulesUnset(workspaceType) && modules.length === 0;
}
