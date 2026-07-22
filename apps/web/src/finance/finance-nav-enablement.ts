/**
 * Phase 1.2 — finance hub **availability** from `workspaceFinance` codegen bindings.
 * Independent of wizard extended-create chrome and product ops panel manifests.
 * Ops panel layout: `@/finance/finance-ops-panels` → workspaceFinance.opsManifest bindings.
 */
import { isFinanceNavPlugin } from "@/bootstrap/workspace-finance-nav-bindings.generated";

export function shouldShowFinanceNav(pluginId: string): boolean {
  return isFinanceNavPlugin(pluginId);
}

export function isFinanceRouteAllowed(pluginId: string): boolean {
  return shouldShowFinanceNav(pluginId);
}
