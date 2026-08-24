/**
 * DP-2 — Denali operational roster derived semantics (DEN-PROD-03).
 * Pure predicates — no I/O.
 */
import { registrationOccupiesSeat } from "@app-tour/tour-core";

export type OperationalRosterLifecycleStatus =
  | "pending"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "cancelled";

export type OperationalRosterFinancialDisplayState =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "WAIVED"
  | "NOT_APPLICABLE";

export type OperationalRosterRefundDisplayState = "none" | "in_flight" | "completed";

export type OperationalRosterPassengerAssignmentStatus = "not_implemented";

export function parseMinorUnits(value: string | null | undefined): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    return BigInt(0);
  }
  try {
    return BigInt(digits);
  } catch {
    return null;
  }
}

export function isFinanciallySettled(remainingMinor: string | null | undefined): boolean {
  const units = parseMinorUnits(remainingMinor);
  return units !== null && units === BigInt(0);
}

export function isOperationalParticipant(status: OperationalRosterLifecycleStatus): boolean {
  return status === "approved";
}

export function isFinalParticipant(input: {
  readonly status: OperationalRosterLifecycleStatus;
  readonly remainingMinor: string | null | undefined;
}): boolean {
  return isOperationalParticipant(input.status) && isFinanciallySettled(input.remainingMinor);
}

export function occupiesCapacity(status: OperationalRosterLifecycleStatus): boolean {
  return registrationOccupiesSeat("booking", status);
}

export function isWaitlisted(status: OperationalRosterLifecycleStatus): boolean {
  return status === "waitlisted";
}

export function deriveFinancialDisplayState(input: {
  readonly status: OperationalRosterLifecycleStatus;
  readonly remainingMinor: string | null | undefined;
  readonly paidMinor: string | null | undefined;
  readonly waived?: boolean;
}): OperationalRosterFinancialDisplayState {
  if (input.status !== "approved") {
    return "NOT_APPLICABLE";
  }
  if (isFinanciallySettled(input.remainingMinor)) {
    return input.waived === true ? "WAIVED" : "PAID";
  }
  const paid = parseMinorUnits(input.paidMinor);
  if (paid !== null && paid > BigInt(0)) {
    return "PARTIALLY_PAID";
  }
  return "UNPAID";
}

export function deriveRefundDisplayState(
  statuses: readonly string[]
): OperationalRosterRefundDisplayState {
  if (statuses.some((s) => s === "Completed")) {
    return "completed";
  }
  if (statuses.some((s) => s === "Requested" || s === "Approved")) {
    return "in_flight";
  }
  return "none";
}

export function isDriverOffer(transportKind: string | null | undefined): boolean {
  return transportKind === "personal_car";
}

export function passengerAssignmentStatus(): OperationalRosterPassengerAssignmentStatus {
  return "not_implemented";
}

export function isPaymentDeadlineExpiringSoon(input: {
  readonly paymentDueAt: string | null | undefined;
  readonly nowIso: string;
  readonly withinHours?: number;
}): boolean {
  const dueRaw = input.paymentDueAt?.trim() ?? "";
  if (dueRaw.length === 0) {
    return false;
  }
  const dueMs = Date.parse(dueRaw);
  const nowMs = Date.parse(input.nowIso);
  if (!Number.isFinite(dueMs) || !Number.isFinite(nowMs)) {
    return false;
  }
  const withinHours = input.withinHours ?? 24;
  const windowMs = withinHours * 3_600_000;
  return dueMs <= nowMs + windowMs;
}

export function compareOperationalRosterParticipantOrder(
  a: { readonly guestLabel: string; readonly registrationId: string },
  b: { readonly guestLabel: string; readonly registrationId: string }
): number {
  const byGuest = a.guestLabel.localeCompare(b.guestLabel, undefined, { sensitivity: "base" });
  if (byGuest !== 0) {
    return byGuest;
  }
  return a.registrationId.localeCompare(b.registrationId);
}

export function compareOperationalRosterWaitlistOrder(
  a: { readonly submittedAt: string; readonly registrationId: string },
  b: { readonly submittedAt: string; readonly registrationId: string }
): number {
  const bySubmitted = Date.parse(a.submittedAt) - Date.parse(b.submittedAt);
  if (bySubmitted !== 0) {
    return bySubmitted;
  }
  return a.registrationId.localeCompare(b.registrationId);
}
