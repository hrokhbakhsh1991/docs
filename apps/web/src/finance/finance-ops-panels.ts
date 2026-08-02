/**
 * Finance **ops panel** capability resolution — not hub availability.
 * Availability SoT: `@/finance/finance-nav-enablement` → capabilities.financeNav.
 * Ops SoT: capabilities.financeOps.resolveManifest (Phase 4be) — no generated binder.
 *
 * Generic web depends on {@link FinanceOpsCapability} only — never imports workspace packages.
 */
import {
  resolveFinanceOpsCapability,
} from "@app-tour/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import type { FinanceOpsCapability } from "@/finance/finance-ops-capability-contract";

export type { FinanceOpsCapability, FinanceOpsManifest } from "@/finance/finance-ops-capability-contract";

/**
 * Resolve finance ops capability for the command center.
 * Unbound / missing financeOps capability → `null` (host renders nothing — no product fallback).
 */
export async function resolveFinanceOpsCapabilityForHub(
  theme: unknown = null,
  pluginId: string
): Promise<FinanceOpsCapability | null> {
  const id = pluginId.trim();
  if (id.length === 0) {
    return null;
  }
  try {
    const plugin = await loadBootstrapWorkspacePlugin(id);
    const financeOps = resolveFinanceOpsCapability(plugin);
    if (financeOps == null) {
      return null;
    }
    return financeOps.resolveManifest(theme) as FinanceOpsCapability;
  } catch {
    return null;
  }
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
