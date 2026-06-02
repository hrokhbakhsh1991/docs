import { RegistrationStatus } from "./registration-status";

/** True when this registration status consumes an accepted seat on the tour. */
export function isCapacityConsumingRegistrationStatus(status: RegistrationStatus): boolean {
  return (
    status === RegistrationStatus.ACCEPTED || status === RegistrationStatus.ACCEPTED_PAID
  );
}

/** Maps target registration status to outbox `eventType` string (stable contract for consumers). */
export function registrationStatusToOutboxEventType(targetStatus: RegistrationStatus): string {
  switch (targetStatus) {
    case RegistrationStatus.ACCEPTED:
      return "registration.accepted";
    case RegistrationStatus.ACCEPTED_PAID:
      return "registration.accepted_paid";
    case RegistrationStatus.REJECTED:
      return "registration.rejected";
    case RegistrationStatus.CANCELLED:
      return "registration.cancelled";
    case RegistrationStatus.NO_SHOW:
      return "registration.no_show";
    case RegistrationStatus.REFUNDED:
      return "registration.refunded";
    default:
      return "registration.status_changed";
  }
}
