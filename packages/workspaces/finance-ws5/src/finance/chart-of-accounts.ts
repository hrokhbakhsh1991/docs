/**
 * Fake Workspace #5 chart of accounts — reusable consumer proof.
 * Must never collide with Denali / ws2 / ws3 / ws4 account prefixes.
 */

export const FINANCE_WS5_WORKSPACE_TYPE = "finance-ws5";

export const FINANCE_WS5_LEDGER_ACCOUNTS = {
  OPERATOR_CASH_CLEARING: "ws5:gl:operator-cash-clearing",
  DISCOUNT_CONTRA: "ws5:gl:discount-contra",
} as const;

export function financeWs5BookingWalletId(registrationId: string): string {
  const id = registrationId.trim();
  if (!id) {
    throw new Error("financeWs5BookingWalletId: registrationId is required");
  }
  return `ws5:booking:${id}`;
}
