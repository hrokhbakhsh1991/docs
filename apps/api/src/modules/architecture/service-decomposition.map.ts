/**
 * @fileoverview Oversized orchestration services (“god services”) and intended layering.
 * This file is documentation-as-code; controllers should stay thin and call application services.
 *
 * **Target stack:** `controller → application service (use case) → repository (TypeORM/data only)`
 * with **pure domain** under each module's `domain` directory (`.ts` files with no Nest, no `EntityManager`).
 */

/** Registration / waitlist / capacity orchestration — still mixes tour locking, outbox, policies. */
export const REGISTRATIONS_GOD_METHODS = [
  "createRegistration",
  "createPublicRegistrationOrWaitlist",
  "updateRegistrationStatus",
  "updateRegistrationPayment",
  "updatePaymentStatus",
  "createWaitlistItem",
  "convertWaitlistItem",
  "cancelWaitlistItem",
  "promoteNextWaitlistSlotIfEligible",
  "transitionRegistrationForPayment",
  "lockTourRowForUpdate"
] as const;

/** Tour write path — create/update packs validation, denormalization, trip-details persistence. */
export const TOURS_GOD_METHODS = [
  "createTour",
  "updateTour",
  "listTours",
  "getTourById",
  "getLeaderWorkspaceAggregate"
] as const;

/** Payments + duplicated registration capacity / waitlist side-effects from payment transitions. */
export const PAYMENTS_GOD_METHODS = [
  "processWebhook",
  "createPaymentIntent",
  "createPaymentIntentWithManager",
  "failTimedOutPendingPayments",
  "refundPayment",
  "applyPaymentStatus (private — candidate for PaymentStatusApplicationService)",
  "transitionRegistrationForPayment (private — should unify with RegistrationsService)"
] as const;
