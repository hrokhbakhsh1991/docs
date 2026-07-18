/**
 * Denali (and future workspace) finance **ops panel** layout — not hub availability.
 * Availability SoT: `@/finance/finance-nav-enablement` → workspaceFinance nav bindings.
 */
import {
  DEFAULT_FINANCE_OPS_MANIFEST,
  resolveFinanceOpsManifestFromTheme,
  type FinanceOpsManifest,
} from "@app-tour/workspace-denali/host/finance/manifest";

export { DEFAULT_FINANCE_OPS_MANIFEST, resolveFinanceOpsManifestFromTheme };
export type { FinanceOpsManifest };

/** Resolve ops panel manifest for the finance command center (Denali theme overrides). */
export function resolveFinanceOpsManifestForHub(theme: unknown = null): FinanceOpsManifest {
  if (theme === null || theme === undefined) {
    return DEFAULT_FINANCE_OPS_MANIFEST;
  }
  return resolveFinanceOpsManifestFromTheme(theme);
}
