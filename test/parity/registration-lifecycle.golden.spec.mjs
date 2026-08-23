import { describe, it } from "node:test";

import {
  BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
  BOOKING_WAITLIST_OUTBOX_EVENT_TYPE,
} from "../../packages/booking-http-contracts/src/booking-lifecycle-events.ts";
import {
  canTransitionDenaliBooking,
  listDenaliBookingTransitionsFrom,
} from "../../packages/workspaces/denali/src/booking/lifecycle.ts";
import { assertGoldenParity, fixturePath } from "./lib/golden-harness.mjs";

/**
 * Mirrors host booking repository outbox emission (decision B: reject silent).
 * @see apps/api/src/bookings/booking-reject-lifecycle.spec.ts
 * @see apps/api/src/bookings/booking-lifecycle.spec.ts
 */
function resolveBookingTransitionOutboxEvent(input) {
  const { action, from, to } = input;
  if (action === "approve" && to === "approved") {
    return BOOKING_APPROVE_OUTBOX_EVENT_TYPE;
  }
  if (action === "waitlist" && from === "pending" && to === "waitlisted") {
    return BOOKING_WAITLIST_OUTBOX_EVENT_TYPE;
  }
  if (action === "cancel" && to === "cancelled") {
    return BOOKING_CANCEL_OUTBOX_EVENT_TYPE;
  }
  if (action === "reject") {
    return null;
  }
  return null;
}

describe("registration lifecycle parity goldens (CW0-04)", () => {
  it("booking path transition edges match Denali/host lifecycle graph", () => {
    assertGoldenParity({
      id: "CW0-04-transition-edges",
      fixturePath: fixturePath("registration-lifecycle/transition-edges.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly statuses: readonly string[];
        }} */ (input);
        /** @type {Record<string, readonly string[]>} */
        const edgesByFrom = {};
        for (const status of typed.statuses) {
          edgesByFrom[status] = listDenaliBookingTransitionsFrom(
            /** @type {import("@app-tour/booking-http-contracts").BookingStatus} */ (
              status
            )
          );
        }
        return { edgesByFrom };
      },
    });
  });

  it("booking path outbox semantics: approve/waitlist/cancel observable, reject silent", () => {
    assertGoldenParity({
      id: "CW0-04-outbox-semantics",
      fixturePath: fixturePath("registration-lifecycle/outbox-semantics.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly cases: readonly {
            readonly action: string;
            readonly from: string;
            readonly to: string;
          }[];
        }} */ (input);
        return {
          results: typed.cases.map((row) => ({
            action: row.action,
            from: row.from,
            to: row.to,
            outboxEventType: resolveBookingTransitionOutboxEvent(row),
          })),
        };
      },
    });
  });

  it("illegal edges are rejected by canTransitionDenaliBooking", () => {
    const illegal = [
      { from: "rejected", to: "approved" },
      { from: "cancelled", to: "approved" },
      { from: "approved", to: "pending" },
      { from: "pending", to: "pending" },
    ];
    for (const edge of illegal) {
      if (
        canTransitionDenaliBooking(
          /** @type {import("@app-tour/booking-http-contracts").BookingStatus} */ (
            edge.from
          ),
          /** @type {import("@app-tour/booking-http-contracts").BookingStatus} */ (
            edge.to
          )
        )
      ) {
        throw new Error(`expected illegal edge ${edge.from} → ${edge.to}`);
      }
    }
  });
});
