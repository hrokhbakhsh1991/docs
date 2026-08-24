/**
 * DEN-PROD-09 — server-side member cancellation eligibility (DP-4).
 * Pure domain; host enforces on POST /bookings/:id/member-cancellation.
 */

export type MemberCancellationMode =
  | "withdraw"
  | "self_cancel"
  | "request"
  | "denied";

export type MemberCancellationReasonCode =
  | "terminal_state"
  | "cancellation_cutoff_passed"
  | "not_owner"
  | "payment_deadline_passed";

export type MemberCancellationEligibility = {
  readonly eligible: boolean;
  readonly mode: MemberCancellationMode;
  readonly reasonCode?: MemberCancellationReasonCode;
};

export type EvaluateDenaliMemberCancellationInput = {
  readonly status: string;
  readonly paymentStatus: string;
  readonly departureAt: string;
  readonly nowIso: string;
  readonly paymentDueAt?: string | null;
  readonly cancellationDeadlineHours?: number | null;
};

function parseInstant(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function resolveCancellationDeadlineInstant(
  departureAt: string,
  cancellationDeadlineHours: number | null | undefined
): number | null {
  if (
    cancellationDeadlineHours === null ||
    cancellationDeadlineHours === undefined ||
    cancellationDeadlineHours <= 0
  ) {
    return null;
  }
  const departureMs = parseInstant(departureAt);
  if (departureMs === null) {
    return null;
  }
  return departureMs - cancellationDeadlineHours * 60 * 60 * 1000;
}

function isPastCutoff(input: EvaluateDenaliMemberCancellationInput): boolean {
  const nowMs = parseInstant(input.nowIso);
  if (nowMs === null) {
    return false;
  }
  const deadlineMs = resolveCancellationDeadlineInstant(
    input.departureAt,
    input.cancellationDeadlineHours
  );
  if (deadlineMs !== null && nowMs >= deadlineMs) {
    return true;
  }
  const dueMs =
    input.paymentDueAt !== null &&
    input.paymentDueAt !== undefined &&
    input.paymentDueAt.trim().length > 0
      ? parseInstant(input.paymentDueAt)
      : null;
  if (
    input.status === "approved" &&
    input.paymentStatus === "unpaid" &&
    dueMs !== null &&
    nowMs >= dueMs
  ) {
    return true;
  }
  return false;
}

/** Evaluate whether a member may cancel / withdraw / request cancellation. */
export function evaluateDenaliMemberCancellationEligibility(
  input: EvaluateDenaliMemberCancellationInput
): MemberCancellationEligibility {
  const { status, paymentStatus } = input;

  if (status === "cancelled" || status === "rejected") {
    return { eligible: false, mode: "denied", reasonCode: "terminal_state" };
  }

  if (isPastCutoff(input)) {
    return {
      eligible: false,
      mode: "denied",
      reasonCode: "cancellation_cutoff_passed",
    };
  }

  if (status === "pending" || status === "waitlisted") {
    return { eligible: true, mode: "withdraw" };
  }

  if (status === "approved") {
    if (paymentStatus === "unpaid") {
      return { eligible: true, mode: "self_cancel" };
    }
    if (paymentStatus === "partial" || paymentStatus === "paid") {
      return { eligible: true, mode: "request" };
    }
  }

  return { eligible: false, mode: "denied", reasonCode: "terminal_state" };
}
