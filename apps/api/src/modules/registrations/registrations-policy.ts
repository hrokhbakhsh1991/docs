import { ConflictException, NotFoundException } from "@nestjs/common";
import { canActAsPlatformAdminWithoutTenant } from "../../common/rbac/workspace-access.helper";
import {
  assertValidBookingTransition,
  BookingTransitionForbiddenError
} from "./domain/assert-valid-booking-transition";
import {
  toBookingStatusFromRegistration,
  toBookingStatusFromTargetRegistrationStatus
} from "./domain/registration-booking-bridge";
import {
  RegistrationPaymentStatus,
  RegistrationStatus
} from "./registration.entity";

export function assertJwtTenantMatchesTourForAuthenticatedMutation(input: {
  role?: string;
  jwtTenantId?: string;
  tourTenantId: string;
}): void {
  if (canActAsPlatformAdminWithoutTenant(input.role)) {
    return;
  }
  if (!input.jwtTenantId || input.jwtTenantId !== input.tourTenantId) {
    throw new NotFoundException({
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "Resource not found in tenant scope"
      }
    });
  }
}

/**
 * Validates a registration status change using the booking state machine
 * (`BOOKING_ALLOWED_TRANSITIONS` / `BookingTransitionRules`).
 *
 * Current and target rows are projected with `toBookingStatusFromRegistration` /
 * `toBookingStatusFromTargetRegistrationStatus` so legacy `RegistrationStatus` + `payment_status`
 * stay the persistence source while rules stay single-sourced in the booking domain.
 */
export function validateStatusTransition(
  currentStatus: RegistrationStatus,
  targetStatus: RegistrationStatus,
  currentPaymentStatus: RegistrationPaymentStatus,
  options?: { treatCurrentAsWaitlisted?: boolean }
): void {
  if (currentStatus === targetStatus) {
    return;
  }

  const from = toBookingStatusFromRegistration(currentStatus, currentPaymentStatus, {
    treatAsWaitlisted: options?.treatCurrentAsWaitlisted
  });
  const to = toBookingStatusFromTargetRegistrationStatus(targetStatus);

  try {
    assertValidBookingTransition(from, to);
  } catch (error: unknown) {
    if (error instanceof BookingTransitionForbiddenError) {
      throw new ConflictException({
        error: {
          code: "STATE_TRANSITION_INVALID",
          message: "Requested registration status transition is not allowed"
        }
      });
    }
    throw error;
  }
}

export function validatePaymentTransition(
  registrationStatus: RegistrationStatus,
  currentPaymentStatus: RegistrationPaymentStatus,
  nextPaymentStatus: RegistrationPaymentStatus
): void {
  if (
    registrationStatus === RegistrationStatus.CANCELLED ||
    registrationStatus === RegistrationStatus.REJECTED
  ) {
    throw new ConflictException({
      error: {
        code: "PAYMENT_STATUS_TRANSITION_INVALID",
        message:
          "Requested payment update is not allowed for cancelled or rejected registration"
      }
    });
  }

  if (currentPaymentStatus === nextPaymentStatus) {
    return;
  }

  const allowedTransitions: Partial<
    Record<RegistrationPaymentStatus, RegistrationPaymentStatus[]>
  > = {
    [RegistrationPaymentStatus.NOT_PAID]: [
      RegistrationPaymentStatus.PAID,
      RegistrationPaymentStatus.FAILED
    ],
    [RegistrationPaymentStatus.PAID]: [RegistrationPaymentStatus.REFUNDED],
    [RegistrationPaymentStatus.FAILED]: [
      RegistrationPaymentStatus.NOT_PAID,
      RegistrationPaymentStatus.PAID
    ]
  };

  const allowedNext = allowedTransitions[currentPaymentStatus] ?? [];
  if (allowedNext.includes(nextPaymentStatus)) {
    return;
  }

  throw new ConflictException({
    error: {
      code: "PAYMENT_STATUS_TRANSITION_INVALID",
      message: "Requested payment update violates payment status lifecycle rules"
    }
  });
}

export function validatePaymentAmountConsistency(
  nextPaymentStatus: RegistrationPaymentStatus,
  paidAmount?: number
): void {
  if (
    nextPaymentStatus === RegistrationPaymentStatus.NOT_PAID &&
    paidAmount !== undefined &&
    paidAmount > 0
  ) {
    throw new ConflictException({
      error: {
        code: "PAYMENT_STATUS_TRANSITION_INVALID",
        message: "NotPaid status cannot have a positive paidAmount"
      }
    });
  }

  if (
    nextPaymentStatus === RegistrationPaymentStatus.PARTIAL &&
    paidAmount !== undefined &&
    paidAmount <= 0
  ) {
    throw new ConflictException({
      error: {
        code: "PAYMENT_STATUS_TRANSITION_INVALID",
        message: "Partial status requires a positive paidAmount when provided"
      }
    });
  }
}

/**
 * Allowed deviation (in minor units) between a client-supplied total and the server-calculated
 * `computed_total_minor` from the canonical booking price snapshot.
 * Set to 1 to absorb any sub-unit rounding while still catching real mismatches.
 */
export const PRICING_MISMATCH_TOLERANCE_MINOR = 1;

/**
 * Throws `PRICING_MISMATCH_ERROR` when the absolute difference between the client-supplied
 * total and the server's canonical snapshot total exceeds {@link PRICING_MISMATCH_TOLERANCE_MINOR}.
 *
 * Call this **before** persisting any registration that receives a client-supplied amount,
 * e.g. from a payment intent webhook or a checkout DTO with a `totalMinor` field.
 *
 * @param clientTotalMinor  — integer minor units supplied by the client (or PSP webhook).
 * @param snapshotComputedTotalMinor — `computed_total_minor` from the locked `BookingPriceSnapshotEntity`.
 */
export function assertPricingMatchOrThrow(
  clientTotalMinor: number | string,
  snapshotComputedTotalMinor: number | string
): void {
  const clientVal = BigInt(Math.round(Number(clientTotalMinor)));
  const snapshotVal = BigInt(Math.round(Number(snapshotComputedTotalMinor)));
  const diff = clientVal > snapshotVal ? clientVal - snapshotVal : snapshotVal - clientVal;
  if (diff > BigInt(PRICING_MISMATCH_TOLERANCE_MINOR)) {
    throw new ConflictException({
      error: {
        code: "PRICING_MISMATCH_ERROR",
        message: `Client-supplied total (${clientVal}) disagrees with server-computed snapshot total (${snapshotVal}) beyond the allowed tolerance of ${PRICING_MISMATCH_TOLERANCE_MINOR} minor unit(s).`
      }
    });
  }
}

