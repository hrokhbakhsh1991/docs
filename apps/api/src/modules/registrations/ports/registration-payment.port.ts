import { EntityManager } from "typeorm";
import { RegistrationEntity, RegistrationStatus } from "../registration.entity";
import { TourEntity } from "../../tours/entities/tour.entity";

export const REGISTRATION_PAYMENT_PORT = Symbol("REGISTRATION_PAYMENT_PORT");

export interface IRegistrationPaymentPort {
  /**
   * Pessimistic tour lock — must be acquired before registration financial locks (deadlock order).
   */
  lockTourRowForUpdate(
    _manager: EntityManager,
    _tourId: string,
    _tenantId: string
  ): Promise<TourEntity>;

  /**
   * FIFO waitlist → registration promotion used when the payment processor frees capacity.
   */
  promoteNextWaitlistItemForPaymentFlow(
    _manager: EntityManager,
    _releasedRegistration: RegistrationEntity,
    _lockedTour: TourEntity | null
  ): Promise<boolean>;

  /**
   * Transition registration status after payment success or failure.
   */
  transitionRegistrationForPayment(
    _manager: EntityManager,
    _registration: RegistrationEntity,
    _targetStatus: RegistrationStatus,
    _actorId: string
  ): Promise<RegistrationEntity>;
}
