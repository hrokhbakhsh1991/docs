/**
 * Workspace type → Booking lifecycle event reaction (Phase B1.7).
 * Adapter classes come from generated manifest bindings; outbox persistence stays host-owned.
 * Resolve is fail-closed: unregistered workspace types throw (no silent no-op).
 * No workspace package imports in this hand-written registry.
 */

import type { WorkspaceBookingEventReactionPort } from "@app-tour/booking-http-contracts";

import {
  isBookingEventReactionBindingRegistered,
  WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS,
} from "./workspace-booking-event-reaction-bindings.generated";

function normalizeWorkspaceType(workspaceType: string): string {
  return workspaceType.trim().toLowerCase();
}

/** True when a workspace type has a registered Booking event reaction adapter. */
export function isWorkspaceBookingEventReactionRegistered(workspaceType: string): boolean {
  const normalized = normalizeWorkspaceType(workspaceType);
  return normalized.length > 0 && isBookingEventReactionBindingRegistered(normalized);
}

/**
 * Resolve Booking lifecycle event capability (approve outbox event type + optional hooks).
 * @throws `BOOKING_EVENT_REACTION_UNSUPPORTED` when workspaceType is not registered.
 */
export function resolveWorkspaceBookingEventReaction(
  workspaceType: string
): WorkspaceBookingEventReactionPort {
  const normalized = normalizeWorkspaceType(workspaceType);
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
  if (binding.requiresHostIo === true) {
    throw new Error(
      `BOOKING_EVENT_REACTION_HOST_IO_UNSUPPORTED: workspaceType=${workspaceType} requires HostIo but Booking HostIo injection is not wired in B1.7`
    );
  }
  return binding.create();
}
