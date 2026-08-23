/**
 * Exact GitHub Actions job `name:` values used as required status check contexts on `main`.
 * Keep in sync with workflow YAML — enforced by verify-required-check-names.mjs.
 */
export const MAIN_BRANCH_REQUIRED_CHECKS = [
  "Production readiness L3 release gate",
  "Phase 0 foundation gate",
  "Phase 0 integration gate",
  "Phase 1 platform-core gate",
  "Booking PostgreSQL capacity",
  "Booking HTTP PostgreSQL",
];

/** Booking production proofs — must never be dropped from required contexts. */
export const BOOKING_POSTGRES_REQUIRED_CHECKS = [
  "Booking PostgreSQL capacity",
  "Booking HTTP PostgreSQL",
];
