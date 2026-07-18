import {
  DEFAULT_FINANCE_OPS_MANIFEST,
  resolveFinanceOpsManifestFromTheme,
  type FinanceOpsManifest,
} from "@app-tour/workspace-denali/host/finance/manifest";

import { isExtendedOperatorWorkspace } from "@/workspace/is-extended-operator-workspace";

export { DEFAULT_FINANCE_OPS_MANIFEST, resolveFinanceOpsManifestFromTheme };
export type { FinanceOpsManifest };

/** Phase 9.7 — finance hub visible only on extended operator workspaces (INV-P9-006). */
export function shouldShowFinanceNav(pluginId: string): boolean {
  return isExtendedOperatorWorkspace(pluginId);
}

export function isFinanceRouteAllowed(pluginId: string): boolean {
  return shouldShowFinanceNav(pluginId);
}

export type FinanceCommandCenterTab =
  | "overview"
  | "payments"
  | "receipts"
  | "prepayments"
  | "installments"
  | "ledger";

/** Full tab catalog (type + deep-link vocabulary). Visibility is manifest-driven. */
export const FINANCE_COMMAND_CENTER_TABS: readonly FinanceCommandCenterTab[] = [
  "overview",
  "payments",
  "receipts",
  "prepayments",
  "installments",
  "ledger",
] as const;

export function resolveFinanceOpsManifestForHub(theme: unknown = null): FinanceOpsManifest {
  if (theme === null || theme === undefined) {
    return DEFAULT_FINANCE_OPS_MANIFEST;
  }
  return resolveFinanceOpsManifestFromTheme(theme);
}

export function listVisibleFinanceTabs(
  manifest: FinanceOpsManifest = DEFAULT_FINANCE_OPS_MANIFEST
): readonly FinanceCommandCenterTab[] {
  return FINANCE_COMMAND_CENTER_TABS.filter((tab) => manifest.panels[tab] === true);
}

export function parseFinanceTab(
  raw: string | null | undefined,
  visibleTabs: readonly FinanceCommandCenterTab[] = listVisibleFinanceTabs()
): FinanceCommandCenterTab {
  const allowed = new Set(visibleTabs);
  if (
    (raw === "payments" ||
      raw === "receipts" ||
      raw === "ledger" ||
      raw === "prepayments" ||
      raw === "installments") &&
    allowed.has(raw)
  ) {
    return raw;
  }
  if (allowed.has("overview")) {
    return "overview";
  }
  return visibleTabs[0] ?? "overview";
}
