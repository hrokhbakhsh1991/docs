/**
 * Finance **ops panel** capability resolution — not hub availability.
 * Availability SoT: `@/finance/finance-nav-enablement` → workspaceFinance nav bindings.
 * Ops SoT: workspace `workspaceFinance.opsManifest` → generated bindings (Phase 1.10.1).
 *
 * Generic web depends on {@link FinanceOpsCapability} only — never imports workspace packages.
 */
import {
  hasFinanceOpsManifest,
  resolveWorkspaceFinanceOpsManifest,
} from "@/bootstrap/workspace-finance-ops-bindings.generated";
import type { FinanceOpsCapability } from "@/finance/finance-ops-capability-contract";

export type { FinanceOpsCapability, FinanceOpsManifest } from "@/finance/finance-ops-capability-contract";

/**
 * Resolve finance ops capability for the command center.
 * Unbound / missing `opsManifest` → `null` (host renders nothing — no Denali fallback).
 */
export function resolveFinanceOpsCapabilityForHub(
  theme: unknown = null,
  pluginId: string
): FinanceOpsCapability | null {
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
export function resolveFinanceOpsManifestForHub(
  theme: unknown = null,
  pluginId: string
): FinanceOpsCapability | null {
  return resolveFinanceOpsCapabilityForHub(theme, pluginId);
}
