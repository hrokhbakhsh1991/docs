import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  RegistrationPaymentStatus,
  RegistrationStatus
} from "./registration.entity";

export function assertJwtTenantMatchesTourForAuthenticatedMutation(input: {
  role?: string;
  jwtTenantId?: string;
  tourTenantId: string;
}): void {
  const role = (input.role ?? "").trim().toLowerCase();
  if (role === "admin") {
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

export function validateStatusTransition(
  currentStatus: RegistrationStatus,
  targetStatus: RegistrationStatus
): void {
  const allowedTransitions: Record<RegistrationStatus, RegistrationStatus[]> = {
    [RegistrationStatus.PENDING]: [
      RegistrationStatus.ACCEPTED,
      RegistrationStatus.ACCEPTED_PAID,
      RegistrationStatus.REJECTED,
      RegistrationStatus.CANCELLED
    ],
    [RegistrationStatus.ACCEPTED]: [
      RegistrationStatus.ACCEPTED_PAID,
      RegistrationStatus.REJECTED,
      RegistrationStatus.CANCELLED,
      RegistrationStatus.NO_SHOW
    ],
    [RegistrationStatus.ACCEPTED_PAID]: [
      RegistrationStatus.REJECTED,
      RegistrationStatus.CANCELLED,
      RegistrationStatus.REFUNDED
    ],
    [RegistrationStatus.REJECTED]: [],
    [RegistrationStatus.CANCELLED]: [],
    [RegistrationStatus.NO_SHOW]: [],
    [RegistrationStatus.REFUNDED]: []
  };

  if (currentStatus === targetStatus) {
    return;
  }

  if (allowedTransitions[currentStatus].includes(targetStatus)) {
    return;
  }

  throw new ConflictException({
    error: {
      code: "STATE_TRANSITION_INVALID",
      message: "Requested registration status transition is not allowed"
    }
  });
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

