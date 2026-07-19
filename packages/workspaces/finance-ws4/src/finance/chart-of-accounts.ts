/**
 * Fake Workspace #4 chart of accounts — drop-in onboarding proof.
 * Account codes and wallet prefix must never collide with Denali, ws2, or ws3.
 */

export const FINANCE_WS4_WORKSPACE_TYPE = "finance-ws4";

export const FINANCE_WS4_LEDGER_ACCOUNTS = {
  OPERATOR_CASH_CLEARING: "ws4:gl:operator-cash-clearing",
  DISCOUNT_CONTRA: "ws4:gl:discount-contra",
} as const;

export function financeWs4BookingWalletId(registrationId: string): string {
  const id = registrationId.trim();
  if (!id) {
    throw new Error("financeWs4BookingWalletId: registrationId is required");
  }
  return `ws4:booking:${id}`;
}
