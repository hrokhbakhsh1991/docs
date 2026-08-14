/**
 * PR17-C — Report-only Commercial Meaning rollout recommendation.
 * Never auto-applies MODE / allowlist / emergency / command UI.
 */

export type CommercialMeaningRolloutRecommendationKind =
  | "HOLD"
  | "CONTINUE"
  | "READY_FOR_COMMAND_UI_PREP";

export type CommercialMeaningRolloutRecommendation = {
  readonly kind: CommercialMeaningRolloutRecommendationKind;
  readonly rationale: string;
  readonly evaluatedAtMs: number;
  readonly mutatesFlags: false;
  readonly blocksFinanceService: false;
  readonly startsCommandUi: false;
};

export type RecommendCommercialMeaningRolloutInput = {
  readonly requestCount: number;
  readonly availabilityRate: number | null;
  readonly timeoutRate: number | null;
  readonly unavailableRate: number | null;
  readonly exceptionRate: number | null;
  readonly returnedToOperationalRate: number | null;
  readonly calibrationFindingCount: number;
  readonly now?: () => number;
  readonly minRequests?: number;
};

/**
 * Derive advisory recommendation from Meaning health + calibration counts.
 */
export function recommendCommercialMeaningRollout(
  input: RecommendCommercialMeaningRolloutInput
): CommercialMeaningRolloutRecommendation {
  const now = input.now ?? Date.now;
  const minRequests = input.minRequests ?? 5;
  const base = {
    evaluatedAtMs: now(),
    mutatesFlags: false as const,
    blocksFinanceService: false as const,
    startsCommandUi: false as const,
  };

  if (input.requestCount < minRequests) {
    return {
      ...base,
      kind: "HOLD",
      rationale: "insufficient_meaning_telemetry_window",
    };
  }

  const availability = input.availabilityRate ?? 0;
  const timeoutRate = input.timeoutRate ?? 0;
  const unavailableRate = input.unavailableRate ?? 0;
  const exceptionRate = input.exceptionRate ?? 0;
  const returnRate = input.returnedToOperationalRate ?? 0;

  if (timeoutRate >= 0.15 || unavailableRate >= 0.25 || availability < 0.7) {
    return {
      ...base,
      kind: "HOLD",
      rationale: "availability_or_timeout_unavailable_pressure",
    };
  }

  if (returnRate >= 0.5 || input.calibrationFindingCount >= 4) {
    return {
      ...base,
      kind: "HOLD",
      rationale: "operator_confusion_or_dense_calibration_findings",
    };
  }

  const healthy =
    availability >= 0.9 &&
    timeoutRate < 0.05 &&
    unavailableRate < 0.1 &&
    exceptionRate < 0.2 &&
    returnRate < 0.25 &&
    input.requestCount >= minRequests * 2;

  if (healthy) {
    return {
      ...base,
      kind: "READY_FOR_COMMAND_UI_PREP",
      rationale: "advisory_only_requires_architect_approval",
    };
  }

  return {
    ...base,
    kind: "CONTINUE",
    rationale: "internal_observation_healthy_enough_to_continue",
  };
}
