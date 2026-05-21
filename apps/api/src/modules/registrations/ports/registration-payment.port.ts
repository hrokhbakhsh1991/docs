import { EntityManager } from "typeorm";
import { RegistrationEntity, RegistrationStatus } from "../registration.entity";
import { TourEntity } from "../../tours/entities/tour.entity";

export const REGISTRATION_PAYMENT_PORT = Symbol("REGISTRATION_PAYMENT_PORT");

export interface IRegistrationPaymentPort {
  /**
   * Pessimistic tour lock — must be acquired before registration financial locks (deadlock order).
   */
  lockTourRowForUpdate(
    manager: EntityManager,
    tourId: string,
    tenantId: string
  ): Promise<TourEntity>;

  /**
   * FIFO waitlist → registration promotion used when the payment processor frees capacity.
   */
  promoteNextWaitlistItemForPaymentFlow(
    manager: EntityManager,
    releasedRegistration: RegistrationEntity,
    lockedTour: TourEntity | null
  ): Promise<boolean>;

  /**
   * Transition registration status after payment success or failure.
   */
  transitionRegistrationForPayment(
    manager: EntityManager,
    registration: RegistrationEntity,
    targetStatus: RegistrationStatus,
    actorId: string
  ): Promise<RegistrationEntity>;
}
