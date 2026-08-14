/**
 * PR14-A — Stale intent protection.
 * Reload current Encounter; reject before SoT mutation when source diverged.
 *
 * Relevant context:
 * - caseKey must match
 * - when `encounterVersionHint` is set (Host meaning fingerprint from GET time),
 *   it must match the fresh CaseOutput fingerprint
 * - otherwise strict `encounterExecutionId` equality (test / correlational mode)
 */

import type { CaseOutput } from "@app-tour/finance-core/case";

import type { CaseCommandSourceEncounter } from "./case-command-intent";
import type { CaseEncounterLoadResult } from "./types";

export class CaseCommandConcurrencyConflictError extends Error {
  readonly code = "CASE_COMMAND_CONCURRENCY_CONFLICT" as const;
  constructor(readonly detail: string) {
    super(`CASE_COMMAND_CONCURRENCY_CONFLICT:${detail}`);
    this.name = "CaseCommandConcurrencyConflictError";
  }
}

export type StaleIntentCheckInput = {
  readonly caseKey: string;
  readonly source: CaseCommandSourceEncounter;
  readonly fresh: CaseEncounterLoadResult;
};

/**
 * Portable meaning fingerprint for stale comparison.
 * Not a Case version row — Host may stamp this on GET Encounter responses.
 */
export function caseOutputMeaningFingerprint(caseOutput: CaseOutput): string {
  const allow = [...(caseOutput.allow as readonly string[])].slice().sort();
  const forbid = [...(caseOutput.forbid as readonly string[])].slice().sort();
  return [
    caseOutput.caseKey,
    caseOutput.reading,
    caseOutput.owner,
    caseOutput.primaryPosture,
    caseOutput.interpretationSentence,
    allow.join(","),
    forbid.join(","),
  ].join("|");
}

/**
 * Compare intent provenance to freshly loaded Encounter.
 * Does not authorize and does not interpret vocabulary as permission.
 */
export function assertIntentNotStale(input: StaleIntentCheckInput): void {
  const { caseKey, source, fresh } = input;
  if (fresh.caseOutput.caseKey !== caseKey) {
    throw new CaseCommandConcurrencyConflictError(
      `case_key_mismatch:intent=${caseKey};fresh=${fresh.caseOutput.caseKey}`
    );
  }
  if (source.encounterExecutionId.trim().length === 0) {
    throw new CaseCommandConcurrencyConflictError("source_execution_id_required");
  }

  const hint = source.encounterVersionHint?.trim();
  if (hint && hint.length > 0) {
    const freshFp = caseOutputMeaningFingerprint(fresh.caseOutput);
    if (hint !== freshFp) {
      throw new CaseCommandConcurrencyConflictError(
        `meaning_fingerprint_mismatch:intent=${hint};fresh=${freshFp}`
      );
    }
    return;
  }

  if (fresh.executionId !== source.encounterExecutionId) {
    throw new CaseCommandConcurrencyConflictError(
      `execution_id_mismatch:intent=${source.encounterExecutionId};fresh=${fresh.executionId}`
    );
  }
}

/** Pure helper for tests / preflight without throwing. */
export function isIntentStale(input: StaleIntentCheckInput): boolean {
  try {
    assertIntentNotStale(input);
    return false;
  } catch {
    return true;
  }
}
