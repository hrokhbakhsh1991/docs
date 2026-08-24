/**
 * Domain status transition helpers — local facade over booking-http-contracts
 * so repositories stay HTTP-contract-free (BK-B1.2).
 */
export {
  canTransitionBookingStatus,
  listBookingSourceStatusesForTarget,
} from "@app-tour/booking-http-contracts";
