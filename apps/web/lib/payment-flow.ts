import type { BookingDto, TourDto } from "@repo/types";

import { extractTourPriceUsd } from "@/components/tours/formatters";

/**
 * Uses **locked booking-time** pricing from the API (`lockedPricing`). Never reads live tour catalog.
 */
export function resolveLockedPricingIntentParamsFromBooking(
  booking: Pick<BookingDto, "lockedPricing">,
): { amount: number; currency: string } | null {
  const lp = booking.lockedPricing;
  if (!lp || typeof lp.totalMinor !== "string") return null;
  const n = Number(lp.totalMinor.trim());
  if (!Number.isFinite(n) || n < 1 || !Number.isSafeInteger(n)) return null;
  const currency =
    typeof lp.currency === "string" && lp.currency.trim() !== "" ? lp.currency.trim().toUpperCase() : "";
  if (!currency) return null;
  return { amount: Math.round(n), currency };
}

/** Tour `costContext.requiresPayment` from API (snake_case tolerated for future). */
export function tourRequiresPaidGate(tour: TourDto | null | undefined): boolean {
  const ctx = tour?.costContext;
  if (!ctx || typeof ctx !== "object") return false;
  const o = ctx as Record<string, unknown>;
  return Boolean(o.requiresPayment ?? o.requires_payment);
}

/**
 * Maps tour pricing to intent payload. USD → integer cents (min 100); IRR → whole units (min 1).
 */
export function deriveIntentAmountCurrency(tour: TourDto): { amount: number; currency: string } | null {
  const ctx = tour.costContext && typeof tour.costContext === "object" ? tour.costContext : null;
  if (!ctx) return null;
  const currencyRaw = (ctx as Record<string, unknown>).currency;
  const currency =
    typeof currencyRaw === "string" && currencyRaw.trim() !== "" ? currencyRaw.trim().toUpperCase() : "USD";
  const raw = (ctx as Record<string, unknown>).totalCost ?? (ctx as Record<string, unknown>).amount;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (currency === "IRR") return { amount: Math.max(1, Math.round(n)), currency };
  return { amount: Math.max(100, Math.round(n * 100)), currency };
}

export function fallbackIntentFromEnv(): { amount: number; currency: string } | null {
  if (typeof process.env.NEXT_PUBLIC_PAYMENT_INTENT_FALLBACK_AMOUNT !== "string") return null;
  const rawAmount = process.env.NEXT_PUBLIC_PAYMENT_INTENT_FALLBACK_AMOUNT.trim();
  const cur = process.env.NEXT_PUBLIC_PAYMENT_INTENT_FALLBACK_CURRENCY?.trim().toUpperCase();
  if (!rawAmount || !cur) return null;
  const n = Number(rawAmount);
  if (!Number.isFinite(n) || n < 1) return null;
  return { amount: Math.round(n), currency: cur };
}

/** Locked booking pricing first; optional env fallback for local dev only (never live tour). */
export function resolvePaymentIntentParamsForBookingCheckout(
  booking: Pick<BookingDto, "lockedPricing">,
): { amount: number; currency: string } | null {
  return resolveLockedPricingIntentParamsFromBooking(booking) ?? fallbackIntentFromEnv();
}

/** Intent amount for `POST /api/v2/payments/intent`: tour metadata first, optional env fallback for dev. */
export function resolveIntentAmountCurrency(tour: TourDto | null | undefined): {
  amount: number;
  currency: string;
} | null {
  if (tour) {
    const fromTour = deriveIntentAmountCurrency(tour);
    if (fromTour) return fromTour;
  }
  return fallbackIntentFromEnv();
}

/** Participant likely needs a payment step (accepted seat, unpaid, priced or gated). */
export function registrationNeedsPaymentUi(args: {
  status: string;
  paymentStatus: string;
  tour: TourDto | null | undefined;
  lockedPricing?: BookingDto["lockedPricing"];
}): boolean {
  if (args.status !== "Accepted") return false;
  if (args.paymentStatus !== "NotPaid" && args.paymentStatus !== "Partial") return false;
  if (tourRequiresPaidGate(args.tour)) return true;
  const locked = args.lockedPricing;
  if (locked && typeof locked.totalMinor === "string") {
    const n = Number(locked.totalMinor.trim());
    if (Number.isFinite(n) && n > 0) return true;
  }
  const price = args.tour ? extractTourPriceUsd(args.tour.costContext ?? null) : 0;
  return price > 0;
}

export function paymentProjectionIsPending(payment: Record<string, unknown> | null | undefined): boolean {
  if (!payment || typeof payment !== "object") return false;
  const st = payment.status ?? payment.paymentStatus;
  return typeof st === "string" && st.trim().toLowerCase() === "pending";
}
