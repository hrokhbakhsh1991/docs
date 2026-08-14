/**
 * Collision precedence — facts win; signals never win.
 */

import type { CaseReading } from "../output/case-output";

export type CollisionCandidate = {
  readonly reading: CaseReading;
  /** Higher wins. */
  readonly priority: number;
  readonly reason: string;
};

/**
 * Deterministic precedence among candidate readings.
 * EXCEPTION outranks happy-path finance; DECISION_READY is a posture flag (not a rival reading).
 */
export function pickReadingByPrecedence(
  candidates: readonly CollisionCandidate[]
): CollisionCandidate {
  if (candidates.length === 0) {
    return {
      reading: "INCOMPLETE_INSPECT",
      priority: 0,
      reason: "no_candidates",
    };
  }
  let best = candidates[0]!;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    if (c.priority > best.priority) {
      best = c;
    }
  }
  return best;
}

/** Priority bands aligned with Interpreter Rules v1 collision table. */
export const READING_PRIORITY = {
  EXCEPTION: 100,
  INCOMPLETE_INSPECT: 90,
  NOT_ELIGIBLE: 80,
  NO_MONEY_DUE: 70,
  SETTLED_CAPTURED: 60,
  CLOSED_IDLE: 55,
  AWAITING_FINANCE: 50,
  PARTIAL_SCOPED: 40,
  INTENT_OPEN_NO_PROOF: 35,
  AWAITING_COUNTERPARTY: 30,
} as const satisfies Record<CaseReading, number>;
