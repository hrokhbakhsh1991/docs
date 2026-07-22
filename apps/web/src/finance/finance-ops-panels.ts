/**
 * Finance **ops panel** capability resolution — not hub availability.
 * Availability SoT: `@/finance/finance-nav-enablement` → workspaceFinance nav bindings.
 * Ops SoT: workspace `workspaceFinance.opsManifest` → generated bindings (Phase 1.10.1 / P4-D3.c).
 *
 * Generic web depends on {@link FinanceOpsCapability} only — never imports workspace packages.
 * Resolve is async (dynamic import) so admin cold graph stays O(1) product packages.
 */
import {
  hasFinanceOpsManifest,
  resolveWorkspaceFinanceOpsManifest,
} from "@/bootstrap/workspace-finance-ops-bindings.generated";
import type { FinanceOpsCapability } from "@/finance/finance-ops-capability-contract";

export type { FinanceOpsCapability, FinanceOpsManifest } from "@/finance/finance-ops-capability-contract";

/**
 * Resolve finance ops capability for the command center.
 * Unbound / missing `opsManifest` → `null` (host renders nothing — no product fallback).
 */
export async function resolveFinanceOpsCapabilityForHub(
  theme: unknown = null,
  pluginId: string
): Promise<FinanceOpsCapability | null> {
  const id = pluginId.trim();
  if (id.length === 0 || !hasFinanceOpsManifest(id)) {
    return null;
  }
  return resolveWorkspaceFinanceOpsManifest(id, theme);
}

/**
 * @deprecated Prefer {@link resolveFinanceOpsCapabilityForHub}.
 * Same soft-resolve semantics (`null` when unbound).
 */
export async function resolveFinanceOpsManifestForHub(
  theme: unknown = null,
  pluginId: string
): Promise<FinanceOpsCapability | null> {
  return resolveFinanceOpsCapabilityForHub(theme, pluginId);
}
