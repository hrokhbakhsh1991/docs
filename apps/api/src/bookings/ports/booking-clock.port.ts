/**
 * Wall clock for booking summary projections and approve approvedAt fallback (B0.2 / B0.5).
 */
export interface BookingClockPort {
  now(): Date;
}
