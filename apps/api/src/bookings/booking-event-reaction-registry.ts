/**
 * Workspace type → Booking lifecycle event reaction.
 * Adapter classes come from generated manifest bindings; outbox persistence stays host-owned.
 * Resolve is fail-closed: unregistered workspace types throw (no silent no-op).
 */

import type { WorkspaceBookingEventReactionPort } from "@app-cloud/booking-http-contracts";

import { WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS } from "./workspace-booking-event-reaction-bindings.generated";

/**
 * Resolve Booking lifecycle event capability (approve outbox event type + post-approve reaction).
 * @throws `BOOKING_EVENT_REACTION_UNSUPPORTED` when workspaceType is not registered.
 */
export function resolveWorkspaceBookingEventReaction(
  workspaceType: string
): WorkspaceBookingEventReactionPort {
  const normalized = workspaceType.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error(
      "BOOKING_EVENT_REACTION_UNSUPPORTED: workspaceType is required to resolve booking event reaction"
    );
  }
  const binding =
    WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS[
      normalized as keyof typeof WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS
    ];
  if (binding === undefined) {
    throw new Error(
      `BOOKING_EVENT_REACTION_UNSUPPORTED: no booking event reaction for workspaceType=${workspaceType}`
    );
  }
  return binding.create();
}
