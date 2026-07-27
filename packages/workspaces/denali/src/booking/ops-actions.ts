/**
 * Map Registration Command Center action keys → Denali domain decisions.
 * Ops manifest (`bookings/`) declares UX; this module keeps the mapping explicit.
 */

import type { BookingCreatePolicyContext } from "@app-cloud/booking-http-contracts";

import {
  DEFAULT_DENALI_CAPACITY_RULE,
  type DenaliCapacityRule,
} from "./capacity-rule";
import type { DenaliBookingSnapshot } from "./lifecycle";
import {
  decideDenaliApprove,
  decideDenaliCancel,
  decideDenaliPromoteWaitlist,
  decideDenaliReject,
  decideDenaliWaitlist,
  type DenaliOperatorDecisionMeta,
} from "./operator-decisions";

/**
 * Ops / domain action keys.
 * Manifest `actions` keys + domain `cancel` / `waitlist` (waitlist may be operator-only).
 */
export type DenaliBookingOpsActionKey =
  | "approve"
  | "reject"
  | "promoteWaitlist"
  | "waitlist"
  | "bulkApprove"
  | "cancel";

export const DENALI_BOOKING_OPS_ACTION_KEYS = Object.freeze([
  "approve",
  "reject",
  "promoteWaitlist",
  "waitlist",
  "bulkApprove",
  "cancel",
] as const satisfies readonly DenaliBookingOpsActionKey[]);

export type ApplyDenaliBookingOpsActionInput = {
  readonly action: DenaliBookingOpsActionKey;
  readonly booking: DenaliBookingSnapshot;
  readonly meta?: DenaliOperatorDecisionMeta;
  readonly capacityCtx?: BookingCreatePolicyContext;
  readonly rule?: DenaliCapacityRule;
};

/**
 * Apply a single ops action. `bulkApprove` applies one approve (caller loops).
 */
export function applyDenaliBookingOpsAction(
  input: ApplyDenaliBookingOpsActionInput
): DenaliBookingSnapshot {
  const meta = input.meta ?? {};
  const rule = input.rule ?? DEFAULT_DENALI_CAPACITY_RULE;

  switch (input.action) {
    case "approve":
    case "bulkApprove":
      return decideDenaliApprove(input.booking, meta, input.capacityCtx, rule);
    case "reject":
      return decideDenaliReject(input.booking, meta);
    case "waitlist":
      return decideDenaliWaitlist(input.booking, meta, rule);
    case "promoteWaitlist":
      return decideDenaliPromoteWaitlist(input.booking, meta, input.capacityCtx, rule);
    case "cancel":
      return decideDenaliCancel(input.booking, meta);
    default: {
      const _exhaustive: never = input.action;
      throw new Error(`DENALI_BOOKING_OPS_ACTION_UNKNOWN: ${String(_exhaustive)}`);
    }
  }
}
