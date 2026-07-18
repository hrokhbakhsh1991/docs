/**
 * Phase 1.2 — finance hub enablement from `workspaceFinance` codegen bindings.
 * Independent of wizard extended-create chrome. Ops panels stay in finance-nav-access.
 */
import { isFinanceNavPlugin } from "@/bootstrap/workspace-finance-nav-bindings.generated";

export function shouldShowFinanceNav(pluginId: string): boolean {
  return isFinanceNavPlugin(pluginId);
}

export function isFinanceRouteAllowed(pluginId: string): boolean {
  return shouldShowFinanceNav(pluginId);
}
