/**
 * Fake Workspace #2 chart of accounts — architecture proof (Phase 1.3 / 1.9 / 1.10).
 * Account codes and wallet prefix must never collide with Denali LEDGER_ACCOUNTS.
 * Manifest: registryOnly — dependency bindings only (no product gate/nav).
 */

export const FINANCE_WS2_WORKSPACE_TYPE = "finance-ws2";

export const FINANCE_WS2_LEDGER_ACCOUNTS = {
  /** WS2 cash clearing — not Denali `gl:leader-registration-payment-clearing`. */
  OPERATOR_CASH_CLEARING: "ws2:gl:operator-cash-clearing",
  DISCOUNT_CONTRA: "ws2:gl:discount-contra",
} as const;

/** Wallet id with workspace-owned prefix (Denali uses `booking:{id}`). */
export function financeWs2BookingWalletId(registrationId: string): string {
  const id = registrationId.trim();
  if (!id) {
    throw new Error("financeWs2BookingWalletId: registrationId is required");
  }
  return `ws2:booking:${id}`;
}
