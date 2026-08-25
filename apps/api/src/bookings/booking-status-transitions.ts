/**
 * Domain-layer re-export — repository transition guards without HTTP/parser coupling.
 * SoT table: `@app-tour/booking-http-contracts` `booking-lifecycle-transitions.ts`.
 */
export {
  canTransitionBookingStatus,
  listBookingSourceStatusesForTarget,
} from "@app-tour/booking-http-contracts";
