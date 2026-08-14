/**
 * Case lifecycle fact provider — eligibility projection only (+ leftover cue).
 * Does not own lifecycle transitions or expose product FSM.
 */

import type { EligibilityFacts, ExceptionCueFacts } from "../facts/fact-groups";
import type { CaseFactProviderResult, CaseFactReadScope } from "./case-fact-read-scope";

export type CaseLifecycleFactBundle = {
  readonly eligibility: EligibilityFacts;
  /** Leftover / meaning cues that lifecycle SoT can assert without finance guessing. */
  readonly exceptionCues: Pick<
    ExceptionCueFacts,
    "closedWithLeftoverArtifacts" | "meaningConflict"
  >;
};

export interface CaseLifecycleFactPort {
  readLifecycleFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CaseLifecycleFactBundle>>;
}
