import { BadRequestException } from "@nestjs/common";

import type {
  RegistrationStatusPolicySnapshot,
  TourCapacityPolicySnapshot,
} from "../domain/registration-policy.types";

export function assertUserNotAlreadyRegistered(
  _tour: TourCapacityPolicySnapshot,
  existingRegistrations: RegistrationStatusPolicySnapshot[]
): void {
  const hasActiveRegistration = existingRegistrations.some((registration) => {
    const normalized = String(registration.status ?? "")
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase();

    return (
      normalized === "ACCEPTED" ||
      normalized === "PENDINGPAYMENT" ||
      normalized === "WAITLIST"
    );
  });

  if (!hasActiveRegistration) {
    return;
  }

  throw new BadRequestException({
    error: {
      code: "USER_ALREADY_REGISTERED",
      message: "User already has an active registration for this tour"
    }
  });
}

export function assertTourCapacityInvariant(tour: TourCapacityPolicySnapshot): void {
  if (tour.acceptedCount <= tour.totalCapacity) {
    return;
  }

  throw new BadRequestException({
    error: {
      code: "CAPACITY_INVARIANT_VIOLATION",
      message: "acceptedCount exceeds totalCapacity"
    }
  });
}
