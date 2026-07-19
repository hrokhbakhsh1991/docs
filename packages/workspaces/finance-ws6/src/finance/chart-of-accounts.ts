/**
 * Fake Workspace #6 chart of accounts — third-party onboarding proof.
 * Must never collide with Denali / ws2–ws5 account prefixes.
 */

export const FINANCE_WS6_WORKSPACE_TYPE = "finance-ws6";

export const FINANCE_WS6_LEDGER_ACCOUNTS = {
  OPERATOR_CASH_CLEARING: "ws6:gl:operator-cash-clearing",
  DISCOUNT_CONTRA: "ws6:gl:discount-contra",
} as const;

export function financeWs6BookingWalletId(registrationId: string): string {
  const id = registrationId.trim();
  if (!id) {
    throw new Error("financeWs6BookingWalletId: registrationId is required");
  }
  return `ws6:booking:${id}`;
}
