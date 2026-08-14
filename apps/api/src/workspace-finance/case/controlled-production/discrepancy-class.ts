/**
 * PR19 — Semantic discrepancy classification (report-only).
 * Never mutates interpreter laws from production frequency alone.
 */

export type ControlledProductionDiscrepancyClass =
  | "HOST_MAPPING"
  | "SOT_POLICY"
  | "CASE_INTERPRETER"
  | "CLASSIC_UI_BEHAVIOR"
  | "EXPECTED_DIFFERENCE";

export type ControlledProductionDiscrepancySample = {
  readonly registrationId: string;
  readonly summary: string;
  readonly classification: ControlledProductionDiscrepancyClass;
  readonly unresolvedNoRuleMatched?: boolean;
};

/**
 * Accept only the four allowed classes — unknown strings fail closed to EXPECTED_DIFFERENCE
 * for reporting (never invent CASE_INTERPRETER without explicit input).
 */
export function normalizeDiscrepancyClass(
  raw: string | undefined
): ControlledProductionDiscrepancyClass {
  switch (raw) {
    case "HOST_MAPPING":
    case "SOT_POLICY":
    case "CASE_INTERPRETER":
    case "CLASSIC_UI_BEHAVIOR":
    case "EXPECTED_DIFFERENCE":
      return raw;
    default:
      return "EXPECTED_DIFFERENCE";
  }
}

export function summarizeDiscrepancyClasses(
  samples: readonly ControlledProductionDiscrepancySample[]
): Readonly<Record<ControlledProductionDiscrepancyClass, number>> {
  const out: Record<ControlledProductionDiscrepancyClass, number> = {
    HOST_MAPPING: 0,
    SOT_POLICY: 0,
    CASE_INTERPRETER: 0,
    CLASSIC_UI_BEHAVIOR: 0,
    EXPECTED_DIFFERENCE: 0,
  };
  for (const s of samples) {
    out[s.classification] += 1;
  }
  return out;
}
