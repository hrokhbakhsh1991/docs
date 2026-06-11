import { DENALI_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-denali/plugin";

/** Phase 9.7 — finance hub visible only on Denali workspace (INV-P9-006). */
export function shouldShowFinanceNav(pluginId: string): boolean {
  return pluginId === DENALI_WORKSPACE_PLUGIN_ID;
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

export const FINANCE_COMMAND_CENTER_TABS: readonly FinanceCommandCenterTab[] = [
  "overview",
  "payments",
  "receipts",
  "prepayments",
  "installments",
  "ledger",
] as const;

export function parseFinanceTab(raw: string | null | undefined): FinanceCommandCenterTab {
  if (
    raw === "payments" ||
    raw === "receipts" ||
    raw === "ledger" ||
    raw === "prepayments" ||
    raw === "installments"
  ) {
    return raw;
  }
  return "overview";
}
