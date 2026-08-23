export const ALPINE_WORKSPACE_TYPE = "alpine";

export const ALPINE_LEDGER_ACCOUNTS = {
  OPERATOR_CASH_CLEARING: "alpine:gl:operator-cash-clearing",
  REGISTRATION_WALLET: "alpine:gl:registration-wallet",
} as const;

export function alpineBookingWalletId(registrationId: string): string {
  const id = registrationId.trim();
  if (id.length === 0) {
    throw new Error("ALPINE_BOOKING_WALLET_ID_REQUIRED");
  }
  return `alpine:booking:${id}`;
}
