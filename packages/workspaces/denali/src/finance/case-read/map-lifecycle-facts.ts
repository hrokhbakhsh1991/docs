/**
 * Denali booking lifecycle SoT → eligibility + leftover cues.
 * Never exposes Denali FSM or lifecycle transitions.
 */

import type { DenaliLifecycleSource } from "./denali-case-read-sources";
import { knownFact, unknownFact } from "./fact-tokens";
import type { CaseLifecycleFactBundle, LifecycleEligibility } from "./portable-facts";
import { unknownLifecycleBundle } from "./unknown-fact-groups";

function mapEligibility(bookingStatus: string): LifecycleEligibility {
  const s = bookingStatus.toLowerCase();
  if (s === "rejected" || s === "cancelled") {
    return "closed";
  }
  if (s === "pending" || s === "approved" || s === "waitlisted") {
    return "eligible";
  }
  return "not_eligible";
}

export function mapDenaliLifecycleToLifecycleFacts(
  source: DenaliLifecycleSource
): CaseLifecycleFactBundle {
  if (source.readStatus === "failed") {
    return unknownLifecycleBundle("lifecycle_read_failed");
  }
  if (source.readStatus === "missing") {
    return unknownLifecycleBundle("lifecycle_sot_missing");
  }

  if (source.bookingStatus === null || source.bookingStatus === undefined) {
    return unknownLifecycleBundle("lifecycle_status_unread");
  }

  const eligibility = mapEligibility(source.bookingStatus);
  const closed = eligibility === "closed";

  let closedWithLeftoverArtifacts: CaseLifecycleFactBundle["exceptionCues"]["closedWithLeftoverArtifacts"];
  if (source.leftoverArtifactsProven === null || source.leftoverArtifactsProven === undefined) {
    closedWithLeftoverArtifacts = closed
      ? unknownFact("leftover_unread")
      : knownFact(false);
  } else {
    closedWithLeftoverArtifacts = knownFact(
      closed && source.leftoverArtifactsProven === true
    );
  }

  let meaningConflict: CaseLifecycleFactBundle["exceptionCues"]["meaningConflict"];
  if (source.meaningConflictProven === null || source.meaningConflictProven === undefined) {
    meaningConflict = knownFact(false);
  } else {
    meaningConflict = knownFact(source.meaningConflictProven);
  }

  return {
    eligibility: { lifecycleEligibility: knownFact(eligibility) },
    exceptionCues: {
      closedWithLeftoverArtifacts,
      meaningConflict,
    },
  };
}
