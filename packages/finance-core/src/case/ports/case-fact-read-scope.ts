/**
 * Scope for Case fact reads — portable ids only (no product-specific types).
 */

import type { CaseSubjectKind } from "../facts/fact-groups";

export type CaseFactReadScope = {
  readonly caseKey: string;
  readonly subjectId: string;
  readonly subjectKind: CaseSubjectKind;
  readonly counterpartyId: string;
};

/**
 * Provider delivery envelope.
 * On degraded/unavailable, fact fields must be unknown — never zero-filled.
 */
export type CaseFactProviderFailureReason =
  | "unavailable"
  | "forbidden"
  | "unsupported"
  | "not_found";

export type CaseFactProviderResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly degraded?: false;
    }
  | {
      readonly ok: false;
      readonly failureReason: CaseFactProviderFailureReason;
      /** Partial or fully-unknown facts — never invented zeros. */
      readonly value: T;
      readonly degraded: true;
    };
