/**
 * Finance command-center tab helpers (panel visibility within an allowed hub).
 * Hub **availability** is `@/finance/finance-nav-enablement` (capabilities.financeNav) — product-blind.
 * Ops panel layout: `@/finance/finance-ops-panels` → capabilities.financeOps (Phase 4be).
 */
import type { FinanceOpsCapability } from "@/finance/finance-ops-capability-contract";

export {
  resolveFinanceOpsCapabilityForHub,
  resolveFinanceOpsManifestForHub,
  type FinanceOpsCapability,
  type FinanceOpsManifest,
} from "@/finance/finance-ops-panels";

export type FinanceCommandCenterTab =
  | "overview"
  | "payments"
  | "receipts"
  | "outstanding"
  | "prepayments"
  | "installments"
  | "ledger"
  | "refunds";

/** Full tab catalog (type + deep-link vocabulary). Visibility is ops-capability-driven. */
export const FINANCE_COMMAND_CENTER_TABS: readonly FinanceCommandCenterTab[] = [
  "overview",
  "payments",
  "receipts",
  "outstanding",
  "prepayments",
  "installments",
  "ledger",
  "refunds",
] as const;

export function listVisibleFinanceTabs(
  capability: FinanceOpsCapability
): readonly FinanceCommandCenterTab[] {
  return FINANCE_COMMAND_CENTER_TABS.filter((tab) => capability.panels[tab] === true);
}

export function parseFinanceTab(
  raw: string | null | undefined,
  visibleTabs: readonly FinanceCommandCenterTab[] = FINANCE_COMMAND_CENTER_TABS
): FinanceCommandCenterTab {
  const allowed = new Set(visibleTabs);
  if (
    (raw === "payments" ||
      raw === "receipts" ||
      raw === "outstanding" ||
      raw === "ledger" ||
      raw === "prepayments" ||
      raw === "installments" ||
      raw === "refunds") &&
    allowed.has(raw)
  ) {
    return raw;
  }
  if (allowed.has("overview")) {
    return "overview";
  }
  return visibleTabs[0] ?? "overview";
}
