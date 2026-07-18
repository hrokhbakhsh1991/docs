import {
  DEFAULT_FINANCE_OPS_MANIFEST,
  resolveFinanceOpsManifestFromTheme,
  type FinanceOpsManifest,
} from "@app-cloud/workspace-denali/host/finance/manifest";

export {
  isFinanceRouteAllowed,
  shouldShowFinanceNav,
} from "@/finance/finance-nav-enablement";

export { DEFAULT_FINANCE_OPS_MANIFEST, resolveFinanceOpsManifestFromTheme };
export type { FinanceOpsManifest };

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
