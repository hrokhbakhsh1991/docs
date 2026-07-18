/**
 * Finance **ops panel** layout resolution — not hub availability.
 * Availability SoT: `@/finance/finance-nav-enablement` → workspaceFinance nav bindings.
 * Ops defaults SoT: workspace `workspaceFinance.opsManifest` → generated bindings (Phase 1.9.2).
 */
import {
  resolveWorkspaceFinanceOpsManifest,
} from "@/bootstrap/workspace-finance-ops-bindings.generated";
import type { FinanceOpsManifest } from "@/finance/finance-ops-manifest-contract";

export type { FinanceOpsManifest };

/**
 * Resolve ops panel manifest for the finance command center.
 * Fail-closed: unknown / unbound pluginId throws (no silent Denali fallback).
 */
export function resolveFinanceOpsManifestForHub(
  theme: unknown = null,
  pluginId: string
): FinanceOpsManifest {
  return resolveWorkspaceFinanceOpsManifest(pluginId, theme);
}
