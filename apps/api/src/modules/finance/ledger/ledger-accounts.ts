/**
 * Synthetic GL-style accounts for in-process double-entry until a full chart of accounts exists.
 *
 * **Leader UI patch** (`paid_amount` on registration): cash/collected amounts are mirrored through
 * this clearing account vs. the per-registration liability (`bookingWalletId`).
 */
export const REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT = "gl:leader-registration-payment-clearing";

/**
 * Operator price deltas / credit notes must post here (offset journals), never by mutating
 * immutable `booking_price_snapshots` rows.
 */
export const DISCOUNT_ADJUSTMENTS_ACCOUNT = "gl:discount-adjustments";
