/**
 * Fact coverage reporting from ephemeral FactSnapshot (PR5-B).
 * Observational only — does not coerce unknown → absent/zero.
 */

import type { CaseFacts, FactSnapshot } from "@app-tour/finance-core/case";

export type FactPresenceBucket = "known" | "unknown" | "absent" | "degraded";

export type ProviderCoverageName =
  | "obligation"
  | "payment"
  | "evidence"
  | "lifecycle"
  | "ledger"
  | "signal";

export type ProviderFactCoverage = {
  readonly provider: ProviderCoverageName;
  readonly required: boolean;
  readonly known: number;
  readonly unknown: number;
  readonly absent: number;
  /** Fields treated as unknown because the provider was degraded. */
  readonly degraded: number;
  readonly totalFields: number;
};

export type FactCoverageReport = {
  readonly providers: readonly ProviderFactCoverage[];
  readonly requiredUnknownFields: number;
  readonly requiredDegradedFields: number;
  readonly requiredTotalFields: number;
};

function bucketOf(kind: string): Exclude<FactPresenceBucket, "degraded"> {
  if (kind === "known") {
    return "known";
  }
  if (kind === "absent") {
    return "absent";
  }
  return "unknown";
}

function countFields(
  values: readonly { readonly kind: string }[],
  degraded: boolean
): Omit<ProviderFactCoverage, "provider" | "required"> {
  let known = 0;
  let unknown = 0;
  let absent = 0;
  let degradedCount = 0;
  for (const value of values) {
    if (degraded) {
      degradedCount += 1;
      unknown += 1;
      continue;
    }
    const bucket = bucketOf(value.kind);
    if (bucket === "known") {
      known += 1;
    } else if (bucket === "absent") {
      absent += 1;
    } else {
      unknown += 1;
    }
  }
  return {
    known,
    unknown,
    absent,
    degraded: degradedCount,
    totalFields: values.length,
  };
}

function moneyFields(facts: CaseFacts["money"]) {
  return [
    facts.obligationPresent,
    facts.collectionPolicy,
    facts.amountDue,
    facts.remaining,
    facts.currency,
    facts.scheduleKind,
    facts.partialScopeDeclared,
  ];
}

function paymentFields(facts: CaseFacts) {
  return [
    facts.intent.intentSet,
    facts.intent.intentKind,
    facts.intent.intentOpen,
    facts.intent.provenanceKnown,
    facts.intent.duplicateOrParallelSuspected,
    facts.settlement.settlementMeaning,
  ];
}

function evidenceFields(facts: CaseFacts["evidence"]) {
  return [
    facts.proofExists,
    facts.proofProgress,
    facts.evidenceInspectable,
    facts.evidenceSource,
  ];
}

function lifecycleFields(facts: CaseFacts) {
  return [
    facts.eligibility.lifecycleEligibility,
    facts.exceptionCues.closedWithLeftoverArtifacts,
    facts.exceptionCues.meaningConflict,
  ];
}

function ledgerFields(facts: CaseFacts["auditCues"]) {
  return [facts.ledgerRefsPresent, facts.reconFinding];
}

/**
 * Build coverage from snapshot + provider degradation list.
 * Signal attention is not a TriFact — counted as known when present, absent when null,
 * unknown when signal provider degraded.
 */
export function buildFactCoverageReport(input: {
  readonly snapshot: FactSnapshot | null;
  readonly degradedProviders?: readonly string[];
}): FactCoverageReport {
  const degraded = new Set(input.degradedProviders ?? []);
  if (input.snapshot === null) {
    const empty = (provider: ProviderCoverageName, required: boolean): ProviderFactCoverage => ({
      provider,
      required,
      known: 0,
      unknown: 0,
      absent: 0,
      degraded: 0,
      totalFields: 0,
    });
    return {
      providers: [
        empty("obligation", true),
        empty("payment", true),
        empty("evidence", true),
        empty("lifecycle", true),
        empty("ledger", false),
        empty("signal", false),
      ],
      requiredUnknownFields: 0,
      requiredDegradedFields: 0,
      requiredTotalFields: 0,
    };
  }

  const facts = input.snapshot.facts;
  const providers: ProviderFactCoverage[] = [
    {
      provider: "obligation",
      required: true,
      ...countFields(moneyFields(facts.money), degraded.has("obligation")),
    },
    {
      provider: "payment",
      required: true,
      ...countFields(paymentFields(facts), degraded.has("payment")),
    },
    {
      provider: "evidence",
      required: true,
      ...countFields(evidenceFields(facts.evidence), degraded.has("evidence")),
    },
    {
      provider: "lifecycle",
      required: true,
      ...countFields(lifecycleFields(facts), degraded.has("lifecycle")),
    },
    {
      provider: "ledger",
      required: false,
      ...countFields(ledgerFields(facts.auditCues), degraded.has("ledger")),
    },
    (() => {
      const signalDegraded = degraded.has("signal");
      if (signalDegraded) {
        return {
          provider: "signal" as const,
          required: false,
          known: 0,
          unknown: 1,
          absent: 0,
          degraded: 1,
          totalFields: 1,
        };
      }
      const hasAttention = input.snapshot.encounter.attention !== undefined;
      return {
        provider: "signal" as const,
        required: false,
        known: hasAttention ? 1 : 0,
        unknown: 0,
        absent: hasAttention ? 0 : 1,
        degraded: 0,
        totalFields: 1,
      };
    })(),
  ];

  let requiredUnknownFields = 0;
  let requiredDegradedFields = 0;
  let requiredTotalFields = 0;
  for (const row of providers) {
    if (!row.required) {
      continue;
    }
    requiredUnknownFields += row.unknown;
    requiredDegradedFields += row.degraded;
    requiredTotalFields += row.totalFields;
  }

  return {
    providers,
    requiredUnknownFields,
    requiredDegradedFields,
    requiredTotalFields,
  };
}
