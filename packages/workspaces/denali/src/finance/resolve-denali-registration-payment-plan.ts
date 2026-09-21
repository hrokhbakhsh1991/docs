import { resolveDenaliPrepaymentPolicy } from "../bookings/resolve-denali-prepayment-policy";

export function resolveDenaliRegistrationPaymentPlan(tourCanonical: unknown) {
  return resolveDenaliPrepaymentPolicy(tourCanonical);
}
