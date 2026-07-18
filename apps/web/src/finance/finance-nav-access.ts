/**
 * Finance command-center tab helpers (panel visibility within an allowed hub).
 * Hub **availability** is `@/finance/finance-nav-enablement` (capability bindings) — not Denali.
 */
import {
  DEFAULT_FINANCE_OPS_MANIFEST,
  type FinanceOpsManifest,
} from "@/finance/finance-ops-panels";

export {
  DEFAULT_FINANCE_OPS_MANIFEST,
  resolveFinanceOpsManifestForHub,
  resolveFinanceOpsManifestFromTheme,
  type FinanceOpsManifest,
} from "@/finance/finance-ops-panels";

export type FinanceCommandCenterTab =
  | "overview"
  | "payments"
  | "receipts"
  | "prepayments"
  | "installments"
  | "ledger";

/** Full tab catalog (type + deep-link vocabulary). Visibility is ops-manifest-driven. */
export const FINANCE_COMMAND_CENTER_TABS: readonly FinanceCommandCenterTab[] = [
  "overview",
  "payments",
  "receipts",
  "prepayments",
  "installments",
  "ledger",
] as const;

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
