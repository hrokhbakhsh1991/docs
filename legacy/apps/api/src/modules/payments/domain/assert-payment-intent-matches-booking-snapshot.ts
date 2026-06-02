import { BadRequestException, ConflictException } from "@nestjs/common";
import type { BookingPriceSnapshotRecord } from "./booking-price-snapshot.types";

/**
 * Payment intents must match the **immutable** booking price snapshot (minor units, same currency).
 * Never compare against live catalog / tour `costContext`.
 */
export function assertPaymentIntentMatchesBookingSnapshot(
  dto: { amount: number; currency: string },
  snapshot: BookingPriceSnapshotRecord
): void {
  if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
    throw new BadRequestException({
      error: {
        code: "PAYMENT_AMOUNT_INVALID",
        message: "Payment amount must be a positive number (minor units matching the booking snapshot)."
      }
    });
  }
  if (!Number.isSafeInteger(dto.amount)) {
    throw new BadRequestException({
      error: {
        code: "PAYMENT_AMOUNT_NOT_SAFE_INTEGER",
        message:
          "Payment amount is too large for JSON number precision; use a value representable as a safe integer in minor units."
      }
    });
  }
  const expectedMinor = snapshot.computedTotalMinor.trim();
  const actualMinor = BigInt(Math.trunc(dto.amount)).toString();
  if (actualMinor !== expectedMinor) {
    throw new ConflictException({
      error: {
        code: "PAYMENT_AMOUNT_SNAPSHOT_MISMATCH",
        message: "Payment amount must exactly match the immutable booking price snapshot."
      }
    });
  }
  const want = dto.currency.trim().toUpperCase();
  const got = snapshot.currency.trim().toUpperCase();
  if (want !== got) {
    throw new ConflictException({
      error: {
        code: "PAYMENT_CURRENCY_SNAPSHOT_MISMATCH",
        message: "Payment currency must match the immutable booking price snapshot."
      }
    });
  }
}
