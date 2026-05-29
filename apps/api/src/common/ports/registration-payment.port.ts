import type { EntityManager } from "typeorm";

import type { RegistrationStatus } from "@repo/types";
import type {
  RegistrationFinancialRecord,
  TourBookingLockRecord,
} from "../contracts/registration-financial.types";

export const REGISTRATION_PAYMENT_PORT = Symbol("REGISTRATION_PAYMENT_PORT");

export interface IRegistrationPaymentPort {
  lockTourRowForUpdate(
    _manager: EntityManager,
    _tourId: string,
    _tenantId: string
  ): Promise<TourBookingLockRecord>;

  promoteNextWaitlistItemForPaymentFlow(
    _manager: EntityManager,
    _releasedRegistration: RegistrationFinancialRecord,
    _lockedTour: TourBookingLockRecord | null
  ): Promise<boolean>;

  transitionRegistrationForPayment(
    _manager: EntityManager,
    _registration: RegistrationFinancialRecord,
    _targetStatus: RegistrationStatus,
    _actorId: string
  ): Promise<RegistrationFinancialRecord>;
}
