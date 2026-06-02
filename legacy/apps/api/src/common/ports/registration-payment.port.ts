import type { RegistrationStatus } from "@repo/types";
import type {
  RegistrationFinancialRecord,
  TourBookingLockRecord,
} from "../contracts/registration-financial.types";

export const REGISTRATION_PAYMENT_PORT = Symbol("REGISTRATION_PAYMENT_PORT");

export interface IRegistrationPaymentPort {
  lockTourRowForUpdate(
    _tourId: string,
    _tenantId: string
  ): Promise<TourBookingLockRecord>;

  promoteNextWaitlistItemForPaymentFlow(
    _releasedRegistration: RegistrationFinancialRecord,
    _lockedTour: TourBookingLockRecord | null
  ): Promise<boolean>;

  transitionRegistrationForPayment(
    _registration: RegistrationFinancialRecord,
    _targetStatus: RegistrationStatus,
    _actorId: string
  ): Promise<RegistrationFinancialRecord>;
}

