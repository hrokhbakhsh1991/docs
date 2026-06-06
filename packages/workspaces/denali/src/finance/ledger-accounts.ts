/** Synthetic GL-style accounts — values aligned with legacy `@repo/shared-contracts`. */
export const LEDGER_ACCOUNTS = {
  REGISTRATION_LEADER_PAYMENT_CLEARING: "gl:leader-registration-payment-clearing",
  DISCOUNT_ADJUSTMENTS: "gl:discount-adjustments",
} as const;

export function bookingWalletId(registrationId: string): string {
  const id = registrationId.trim();
  if (!id) {
    throw new Error("bookingWalletId: registrationId is required");
  }
  return `booking:${id}`;
}
