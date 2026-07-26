/**
 * Phase 1.2 / Thin Shell Phase 4bd — finance hub **availability** from capabilities.financeNav.
 * Independent of wizard extended-create chrome and product ops panel manifests.
 * Ops panel layout: `@/finance/finance-ops-panels` → capabilities.financeOps (Phase 4be).
 *
 * Sync helpers read the warm cache — callers must `ensureFinanceNavSupported` first
 * (operator layout, finance page, dashboard client).
 */
import {
  ensureFinanceNavSupported,
  isFinanceNavPlugin,
} from "@/finance/finance-nav-registry";

export { ensureFinanceNavSupported, isFinanceNavPlugin };

export function shouldShowFinanceNav(pluginId: string): boolean {
  return isFinanceNavPlugin(pluginId);
}

export function isFinanceRouteAllowed(pluginId: string): boolean {
  return shouldShowFinanceNav(pluginId);
}

/** Ensure then gate — preferred for async server routes. */
export async function ensureFinanceRouteAllowed(pluginId: string): Promise<boolean> {
  return ensureFinanceNavSupported(pluginId);
}
