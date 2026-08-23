/**
 * Phase 9.5 — Denali Registration Command Center default manifest (DEC-P9-011).
 * Phase B1.6 — also exposed as workspaceBooking.opsManifest (Finance ops mirror).
 * @see docs/phase-9/appendices/BOOKINGS-OPS-UX.md §5
 *
 * `statusPipeline` derives from shared booking contract (CW4-03).
 * Transition rules: `booking-http-contracts` — this file declares operator UX only.
 */
import { BOOKING_STATUS_PIPELINE } from "@app-tour/booking-http-contracts";
import {
  validateRegistrationOpsManifest,
  type RegistrationOpsManifest,
} from "@app-tour/workspace-sdk";

export const denaliRegistrationOpsManifest = Object.freeze({
  id: "denali_registration_ops",
  defaultView: "inbox_table",
  views: Object.freeze(["inbox_table", "tour_board", "departure_timeline"] as const),
  statusPipeline: BOOKING_STATUS_PIPELINE,
  kpiCards: Object.freeze([
    "pending",
    "approved_today",
    "departures_7d",
    "waitlist",
  ] as const),
  filters: Object.freeze([
    "tourId",
    "status",
    "departureRange",
    "paymentStatus",
    "search",
  ] as const),
  columns: Object.freeze({
    inbox_table: Object.freeze([
      "guest",
      "tour",
      "departure",
      "party",
      "capacity",
      "payment",
      "status",
      "actions",
    ] as const),
    tour_board: Object.freeze({
      groupBy: "tourId",
      columns: Object.freeze(["pending", "approved", "waitlist", "rejected"] as const),
    }),
  }),
  actions: Object.freeze({
    approve: Object.freeze({
      ability: "operator.bookings.approve",
      outboxEvent: "registration.approved",
    }),
    reject: Object.freeze({
      ability: "operator.bookings.approve",
      requiresReason: false,
    }),
    promoteWaitlist: Object.freeze({ ability: "operator.bookings.approve" }),
    bulkApprove: Object.freeze({ ability: "operator.bookings.approve", maxBatch: 25 }),
  }),
  leaderReviewAlias: Object.freeze({
    enabled: true,
    path: "/leader/review",
    query: "view=inbox_table&scope=leader",
  }),
}) satisfies RegistrationOpsManifest;

validateRegistrationOpsManifest(denaliRegistrationOpsManifest);

/** B1.6 — workspaceBooking.opsManifest.defaultExport */
export const DEFAULT_BOOKING_OPS_MANIFEST = denaliRegistrationOpsManifest;

/** B1.6 — theme overlay hook (Denali: theme does not alter registration ops today). */
export function resolveBookingOpsManifestFromTheme(
  _theme: unknown = null
): RegistrationOpsManifest {
  return denaliRegistrationOpsManifest;
}

export function getDenaliRegistrationOpsManifest(): RegistrationOpsManifest {
  return denaliRegistrationOpsManifest;
}
