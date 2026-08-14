/**
 * Finance Case Encounter HTTP response contracts (PR12-B / PR13-A / PR14-B).
 * Presentation only — structurally aligned with CaseEncounterViewContract.
 */

import type { FinanceCaseCommandCapability } from "./finance-case-command-capability.contracts";

export type FinanceCaseEncounterPresentation = {
  readonly subjectId: string;
  readonly subjectKind: string;
  readonly caseKey: string;
  readonly reading: string;
  readonly owner: string;
  readonly lane: string;
  readonly primaryPosture: string;
  readonly decisionReady: boolean;
  readonly allow: readonly string[];
  readonly forbid: readonly string[];
  readonly auditAltitude: boolean;
  readonly explainability: {
    readonly headline: string;
    readonly reading: string;
    readonly owner: string;
    readonly ownerSummary: string;
    readonly primaryPosture: string;
    readonly lane: string;
    readonly decisionReady: boolean;
    readonly auditAltitude: boolean;
  };
  readonly confidence: {
    readonly whyVisible: string;
    readonly whyMineOrNot: string;
    readonly ifIWait: string;
    readonly avoid: string;
  };
  readonly completeness: {
    readonly completenessClass: string;
    readonly actReady: boolean;
    readonly waitComplete: boolean;
    readonly inspectForced: boolean;
    readonly escalateForced: boolean;
    readonly displayToken: string;
  };
  readonly discoveryAttention: {
    readonly attentionClass: string;
    readonly reasonCode?: string;
  } | null;
};

/** Operator presentation chrome on successful load (PR13-A). */
export type FinanceCaseEncounterSurfaceState = "normal" | "degraded" | "incomplete";

export type FinanceCaseEncounterHttpOk = {
  readonly encounter: FinanceCaseEncounterPresentation;
  readonly executionId: string;
  readonly surfaceState: FinanceCaseEncounterSurfaceState;
  /** PR14-B — Host meaning fingerprint for stale intent (not Case status). */
  readonly meaningFingerprint?: string;
  /** PR14-B — command capability metadata for UI seam (no buttons). */
  readonly commandCapability?: FinanceCaseCommandCapability;
};

export type FinanceCaseEncounterHttpErrorCode =
  | "CASE_ENCOUNTER_VIEW_AUTHZ_DENIED"
  | "CASE_ENCOUNTER_NOT_FOUND"
  | "CASE_ENCOUNTER_DISABLED"
  | "CASE_ENCOUNTER_UNAVAILABLE";

export type FinanceCaseEncounterLoadResult =
  | { readonly status: 200; readonly body: FinanceCaseEncounterHttpOk }
  | {
      readonly status: 403 | 404 | 503;
      readonly error: {
        readonly code: FinanceCaseEncounterHttpErrorCode;
        readonly message: string;
      };
    };

/** Optional query: counterpartyId. */
export function parseCaseEncounterCounterpartyId(raw: string | null): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}
