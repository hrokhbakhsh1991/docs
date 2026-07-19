/**
 * Executable booking capability levels — reads generated matrix only (no second registry).
 * Fail-closed when claims exceed adapters / event bindings.
 */
import type {
  BookingCapacityPolicyPort,
  BookingPublicCapabilityPort,
  BookingValidationPolicyPort,
  WorkspaceBookingEventReactionPort,
} from "@app-tour/booking-http-contracts";

import { BookingCapabilityViolationError } from "./bookings.errors";
import { WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS } from "./workspace-booking-event-reaction-bindings.generated";
import {
  getBookingWorkspaceCapabilities,
  type BookingWorkspaceCapabilities,
} from "./workspace-booking-capabilities.generated";
import { isBookingSupportedWorkspace } from "./workspace-booking-bindings.generated";

export type BookingRuntimeCapabilityAdapters = {
  readonly publicBooking: BookingPublicCapabilityPort;
  readonly validationPolicy: BookingValidationPolicyPort;
  readonly capacityPolicy: BookingCapacityPolicyPort;
  readonly eventReaction: WorkspaceBookingEventReactionPort;
};

/**
 * Resolve graded capabilities for a supported workspaceType.
 * `supported=true` without a matrix row is a hard violation.
 */
export function requireBookingWorkspaceCapabilities(
  workspaceType: string
): BookingWorkspaceCapabilities {
  const normalized = workspaceType.trim().toLowerCase();
  if (!isBookingSupportedWorkspace(normalized)) {
    throw new BookingCapabilityViolationError({
      workspaceType: normalized,
      capability: "enabled",
      detail: "workspace is not booking-supported",
    });
  }
  const caps = getBookingWorkspaceCapabilities(normalized);
  if (caps === null) {
    throw new BookingCapabilityViolationError({
      workspaceType: normalized,
      capability: "enabled",
      detail: "supported=true but graded capabilities matrix row missing",
    });
  }
  if (caps.enabled !== true) {
    throw new BookingCapabilityViolationError({
      workspaceType: normalized,
      capability: "enabled",
      detail: "capabilities.enabled must be true for supported workspaces",
    });
  }
  return caps;
}

/**
 * Cross-check claimed levels vs live adapters + generated event bindings.
 * Detects hollow claims / capability downgrades (claim stronger than implementation).
 */
export function assertBookingRuntimeCapabilitiesMatchAdapters(
  workspaceType: string,
  caps: BookingWorkspaceCapabilities,
  adapters: BookingRuntimeCapabilityAdapters
): void {
  const normalized = workspaceType.trim().toLowerCase();

  // --- publicCreate ---
  if (caps.publicCreate.enabled && caps.publicCreate.mode === "create-pipeline") {
    if (typeof adapters.publicBooking.supportsPublicCreate !== "function") {
      throw new BookingCapabilityViolationError({
        workspaceType: normalized,
        capability: "publicCreate",
        detail: "create-pipeline claimed but publicBooking.supportsPublicCreate missing",
      });
    }
    if (!adapters.publicBooking.supportsPublicCreate()) {
      throw new BookingCapabilityViolationError({
        workspaceType: normalized,
        capability: "publicCreate",
        detail: "create-pipeline claimed but adapter.supportsPublicCreate()=false (downgrade)",
      });
    }
  }

  // --- validationMode ---
  if (caps.validation.enabled && caps.validation.mode !== "none") {
    if (typeof adapters.validationPolicy.assertCreateValid !== "function") {
      throw new BookingCapabilityViolationError({
        workspaceType: normalized,
        capability: "validationMode",
        detail: `mode=${caps.validation.mode} claimed but validationPolicy.assertCreateValid missing`,
      });
    }
  } else if (caps.validation.mode === "none" && caps.operatorCreate.mode === "create-pipeline") {
    throw new BookingCapabilityViolationError({
      workspaceType: normalized,
      capability: "validationMode",
      detail: "operatorCreate create-pipeline requires validationMode != none",
    });
  }

  // --- capacityMode (booking-owned) ---
  if (caps.capacity.enabled && caps.capacity.mode === "booking-owned") {
    if (typeof adapters.capacityPolicy.assertCreateCapacity !== "function") {
      throw new BookingCapabilityViolationError({
        workspaceType: normalized,
        capability: "capacityMode",
        detail: `mode=${caps.capacity.mode} claimed but capacityPolicy.assertCreateCapacity missing`,
      });
    }
  } else if (caps.capacity.mode === "none" && caps.operatorCreate.mode === "create-pipeline") {
    throw new BookingCapabilityViolationError({
      workspaceType: normalized,
      capability: "capacityMode",
      detail: "operatorCreate create-pipeline requires capacityMode != none",
    });
  }

  // --- eventReactionMode vs generated binding ---
  const reactionKey = normalized as keyof typeof WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS;
  const binding = WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS[reactionKey];
  const mode = caps.eventReaction.mode;

  if (mode === "none") {
    if (binding !== undefined) {
      throw new BookingCapabilityViolationError({
        workspaceType: normalized,
        capability: "eventReactionMode",
        detail: "mode=none but event reaction binding is registered",
      });
    }
    if (typeof adapters.eventReaction.reactAfterApprove === "function") {
      if (caps.approval.enabled) {
        throw new BookingCapabilityViolationError({
          workspaceType: normalized,
          capability: "eventReactionMode",
          detail: "mode=none but eventReaction adapter present while approval enabled",
        });
      }
    }
  } else if (mode === "in-process") {
    if (binding === undefined) {
      throw new BookingCapabilityViolationError({
        workspaceType: normalized,
        capability: "eventReactionMode",
        detail: "in-process claimed but no event reaction binding",
      });
    }
    if (typeof adapters.eventReaction.reactAfterApprove !== "function") {
      throw new BookingCapabilityViolationError({
        workspaceType: normalized,
        capability: "eventReactionMode",
        detail: "in-process claimed but reactAfterApprove not implemented",
      });
    }
  }
}

/** Composition entry: supported workspace must load matrix + match adapters. */
export function assertBookingRuntimeCapabilityLevels(
  workspaceType: string,
  adapters: BookingRuntimeCapabilityAdapters
): BookingWorkspaceCapabilities {
  const caps = requireBookingWorkspaceCapabilities(workspaceType);
  assertBookingRuntimeCapabilitiesMatchAdapters(workspaceType, caps, adapters);
  return caps;
}
