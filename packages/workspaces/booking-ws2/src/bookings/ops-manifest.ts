/**
 * Booking-ws2 registration ops fixture (Phase B1.6) — distinct from Denali.
 * UI metadata only; no authz / persistence / approve logic.
 */
import {
  validateRegistrationOpsManifest,
  type RegistrationOpsManifest,
} from "@app-tour/workspace-sdk";

export const DEFAULT_BOOKING_OPS_MANIFEST = Object.freeze({
  id: "booking_ws2_registration_ops",
  defaultView: "inbox_table",
  views: Object.freeze(["inbox_table"] as const),
  statusPipeline: Object.freeze(["pending", "approved", "rejected"] as const),
  kpiCards: Object.freeze(["pending", "approved_today"] as const),
  filters: Object.freeze(["tourId", "status", "search"] as const),
  columns: Object.freeze({
    inbox_table: Object.freeze(["guest", "tour", "status", "actions"] as const),
    tour_board: Object.freeze({
      groupBy: "tourId" as const,
      columns: Object.freeze(["pending", "approved"] as const),
    }),
  }),
  actions: Object.freeze({
    approve: Object.freeze({
      ability: "operator.bookings.approve",
      outboxEvent: "registration.approved",
    }),
    reject: Object.freeze({
      ability: "operator.bookings.approve",
      requiresReason: true,
    }),
    promoteWaitlist: Object.freeze({ ability: "operator.bookings.approve" }),
    bulkApprove: Object.freeze({ ability: "operator.bookings.approve", maxBatch: 10 }),
  }),
  leaderReviewAlias: Object.freeze({
    enabled: false,
    path: "/leader/review",
    query: "view=inbox_table",
  }),
}) satisfies RegistrationOpsManifest;

validateRegistrationOpsManifest(DEFAULT_BOOKING_OPS_MANIFEST);

export function resolveBookingOpsManifestFromTheme(
  _theme: unknown = null
): RegistrationOpsManifest {
  return DEFAULT_BOOKING_OPS_MANIFEST;
}
