/**
 * Fake Workspace #3 chart of accounts — drop-in onboarding proof.
 * Account codes and wallet prefix must never collide with Denali or finance-ws2.
 * Manifest: workspaceFinance.supported — product finance gate + dependency bindings.
 */

export const FINANCE_WS3_WORKSPACE_TYPE = "finance-ws3";

export const FINANCE_WS3_LEDGER_ACCOUNTS = {
  /** WS3 cash clearing — not Denali / ws2 clearing accounts. */
  OPERATOR_CASH_CLEARING: "ws3:gl:operator-cash-clearing",
  DISCOUNT_CONTRA: "ws3:gl:discount-contra",
} as const;

/** Wallet id with workspace-owned prefix. */
export function financeWs3BookingWalletId(registrationId: string): string {
  const id = registrationId.trim();
  if (!id) {
    throw new Error("financeWs3BookingWalletId: registrationId is required");
  }
  return `ws3:booking:${id}`;
}
