const BOOKING_WALLET_PREFIX = "booking:";

export function parseBookingIdFromWalletAccount(bookingWalletId: string): string {
  const trimmed = bookingWalletId.trim();
  if (!trimmed.startsWith(BOOKING_WALLET_PREFIX)) {
    throw new Error("INVALID_BOOKING_WALLET_ID: account must start with booking:");
  }
  const bookingId = trimmed.slice(BOOKING_WALLET_PREFIX.length).trim();
  if (bookingId.length === 0) {
    throw new Error("INVALID_BOOKING_WALLET_ID: booking id is required");
  }
  return bookingId;
}

export function bookingWalletIdForRegistration(bookingId: string): string {
  return `${BOOKING_WALLET_PREFIX}${bookingId.trim()}`;
}
