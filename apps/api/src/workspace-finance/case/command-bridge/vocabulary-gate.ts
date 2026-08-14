/**
 * Vocabulary gate — allow/forbid hints on fresh CaseOutput (PR9-B).
 * Hints are not executable permissions; Host still requires authz + SoT validation.
 */

import type { CaseOutput } from "@app-tour/finance-core/case";

import type { ReviewReceiptActionToken } from "./types";

export class CaseCommandVocabularyRejectedError extends Error {
  readonly code = "CASE_COMMAND_VOCABULARY_REJECTED" as const;
  constructor(readonly detail: string) {
    super(`CASE_COMMAND_VOCABULARY_REJECTED:${detail}`);
    this.name = "CaseCommandVocabularyRejectedError";
  }
}

/**
 * Dual-gate half #2: action token must be in allow and not in forbid on **fresh** CaseOutput.
 */
export function assertReviewReceiptVocabulary(
  caseOutput: CaseOutput,
  actionToken: ReviewReceiptActionToken
): void {
  const allow = caseOutput.allow as readonly string[];
  const forbid = caseOutput.forbid as readonly string[];
  if (forbid.includes(actionToken)) {
    throw new CaseCommandVocabularyRejectedError(`forbid:${actionToken}`);
  }
  if (!allow.includes(actionToken)) {
    throw new CaseCommandVocabularyRejectedError(`missing_allow:${actionToken}`);
  }
}

/** Pure helper for tests — same facts ⇒ same gate outcome. */
export function vocabularyAllows(
  caseOutput: CaseOutput,
  actionToken: ReviewReceiptActionToken
): boolean {
  try {
    assertReviewReceiptVocabulary(caseOutput, actionToken);
    return true;
  } catch {
    return false;
  }
}
