/**
 * Finance Command Center view mode (PR17-A).
 * Operational = classic panels; meaning = Encounter commercial interpretation.
 * Not a financeOps panel tab — does not replace payments/receipts/ledger.
 */

export type FinanceCommandCenterViewMode = "operational" | "meaning";

export function parseFinanceCommandCenterView(
  raw: string | null | undefined
): FinanceCommandCenterViewMode {
  if (raw === "meaning" || raw === "commercial" || raw === "case") {
    return "meaning";
  }
  return "operational";
}

export function financeCommandCenterViewQueryValue(
  mode: FinanceCommandCenterViewMode
): string | null {
  return mode === "meaning" ? "meaning" : null;
}
