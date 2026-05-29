import { Inject, Injectable } from "@nestjs/common";

import {
  REGISTRATIONS_APPLICATION_PORT,
  type RegistrationsApplicationPort,
} from "./domain/ports/registrations-application.port";
import type { IRegistrationPaymentPort } from "./ports/registration-payment.port";

const DELEGATED_METHODS: (keyof RegistrationsApplicationPort)[] = [
  "getTenantIdForTourOrThrow",
  "createRegistration",
  "resolveAuthenticatedBookingInput",
  "createBooking",
  "listRegistrationsForTour",
  "listLeaderRegistrationIndex",
  "getLeaderRegistrationStats",
  "listWaitlistItemsForTour",
  "listBookings",
  "getRegistrationById",
  "updateRegistrationStatus",
  "updateRegistrationPayment",
  "updatePaymentStatus",
  "createWaitlistItem",
  "convertWaitlistItem",
  "cancelWaitlistItem",
  "lockTourRowForUpdate",
  "promoteNextWaitlistSlotIfEligible",
  "promoteNextWaitlistItemForPaymentFlow",
  "transitionRegistrationForPayment",
  "getPublicFlowMetrics",
  "createPublicRegistrationOrWaitlist",
];

/**
 * Application-layer facade: delegates to {@link REGISTRATIONS_APPLICATION_PORT} (TypeORM adapter in `repositories/`).
 */
@Injectable()
export class RegistrationsService implements RegistrationsApplicationPort, IRegistrationPaymentPort {
  constructor(
    @Inject(REGISTRATIONS_APPLICATION_PORT)
    private readonly core: RegistrationsApplicationPort
  ) {
    for (const method of DELEGATED_METHODS) {
      const fn = this.core[method];
      if (typeof fn === "function") {
        (this as Record<string, unknown>)[method as string] = fn.bind(this.core);
      }
    }
  }

  getTenantIdForTourOrThrow!: RegistrationsApplicationPort["getTenantIdForTourOrThrow"];
  createRegistration!: RegistrationsApplicationPort["createRegistration"];
  resolveAuthenticatedBookingInput!: RegistrationsApplicationPort["resolveAuthenticatedBookingInput"];
  createBooking!: RegistrationsApplicationPort["createBooking"];
  listRegistrationsForTour!: RegistrationsApplicationPort["listRegistrationsForTour"];
  listLeaderRegistrationIndex!: RegistrationsApplicationPort["listLeaderRegistrationIndex"];
  getLeaderRegistrationStats!: RegistrationsApplicationPort["getLeaderRegistrationStats"];
  listWaitlistItemsForTour!: RegistrationsApplicationPort["listWaitlistItemsForTour"];
  listBookings!: RegistrationsApplicationPort["listBookings"];
  getRegistrationById!: RegistrationsApplicationPort["getRegistrationById"];
  updateRegistrationStatus!: RegistrationsApplicationPort["updateRegistrationStatus"];
  updateRegistrationPayment!: RegistrationsApplicationPort["updateRegistrationPayment"];
  updatePaymentStatus!: RegistrationsApplicationPort["updatePaymentStatus"];
  createWaitlistItem!: RegistrationsApplicationPort["createWaitlistItem"];
  convertWaitlistItem!: RegistrationsApplicationPort["convertWaitlistItem"];
  cancelWaitlistItem!: RegistrationsApplicationPort["cancelWaitlistItem"];
  lockTourRowForUpdate!: RegistrationsApplicationPort["lockTourRowForUpdate"];
  promoteNextWaitlistSlotIfEligible!: RegistrationsApplicationPort["promoteNextWaitlistSlotIfEligible"];
  promoteNextWaitlistItemForPaymentFlow!: RegistrationsApplicationPort["promoteNextWaitlistItemForPaymentFlow"];
  transitionRegistrationForPayment!: RegistrationsApplicationPort["transitionRegistrationForPayment"];
  getPublicFlowMetrics!: RegistrationsApplicationPort["getPublicFlowMetrics"];
  createPublicRegistrationOrWaitlist!: RegistrationsApplicationPort["createPublicRegistrationOrWaitlist"];
}
