/**
 * Operator-facing Encounter presentation DTO (PR12-A).
 * Structurally aligned with @app-tour/finance-case-encounter-ui CaseEncounterViewContract.
 * Host must never put CaseOutput / FactSnapshot into this payload.
 */

export type CaseEncounterPresentation = {
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

export type CaseEncounterPresentationResponse = {
  readonly encounter: CaseEncounterPresentation;
  readonly executionId: string;
  /** Optional until all loaders emit PR14-B fingerprint. */
  readonly meaningFingerprint?: string;
  /**
   * PR15-H — Host telemetry only; never part of Encounter HTTP OK allowlist.
   */
  readonly providerObservation?: {
    readonly degradedProviders: readonly string[];
    readonly providers: Readonly<
      Record<
        string,
        {
          readonly invoked: boolean;
          readonly ok: boolean;
          readonly degraded: boolean;
          readonly failureReason?: string;
        }
      >
    >;
  };
};
