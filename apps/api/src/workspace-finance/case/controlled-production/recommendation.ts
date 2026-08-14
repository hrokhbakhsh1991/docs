/**
 * PR19 — Advisory controlled-production recommendation.
 * Never auto-applies MODE / allowlist / Command UI / shadow.
 */

export type ControlledProductionRecommendationKind =
  | "CONTINUE"
  | "HOLD"
  | "READY_FOR_EXPANSION";

export type ControlledProductionRecommendation = {
  readonly kind: ControlledProductionRecommendationKind;
  readonly rationale: string;
  readonly evaluatedAtMs: number;
  readonly mutatesFlags: false;
  readonly expandsTenants: false;
  readonly enablesShadow: false;
  readonly expandsVocabulary: false;
};

export type RecommendControlledProductionInput = {
  readonly safetyOk: boolean;
  readonly requestCount: number;
  readonly commandSubmitted: number;
  readonly commandSuccessRate: number | null;
  readonly staleRate: number | null;
  readonly authDeniedRate: number | null;
  readonly meaningAvailability: number | null;
  readonly meaningTimeoutRate: number | null;
  readonly exceptionRate: number | null;
  readonly incompleteRate: number | null;
  readonly caseInterpreterDiscrepancyCount: number;
  readonly now?: () => number;
  readonly minRequests?: number;
  readonly minCommands?: number;
};

/**
 * Derive advisory recommendation from observation window metrics.
 */
export function recommendControlledProduction(
  input: RecommendControlledProductionInput
): ControlledProductionRecommendation {
  const now = input.now ?? Date.now;
  const minRequests = input.minRequests ?? 5;
  const minCommands = input.minCommands ?? 1;
  const base = {
    evaluatedAtMs: now(),
    mutatesFlags: false as const,
    expandsTenants: false as const,
    enablesShadow: false as const,
    expandsVocabulary: false as const,
  };

  if (!input.safetyOk) {
    return { ...base, kind: "HOLD", rationale: "rollout_safety_failed" };
  }

  if (input.requestCount < minRequests) {
    return { ...base, kind: "HOLD", rationale: "insufficient_observation_window" };
  }

  const availability = input.meaningAvailability ?? 0;
  const timeoutRate = input.meaningTimeoutRate ?? 0;
  const staleRate = input.staleRate ?? 0;
  const authRate = input.authDeniedRate ?? 0;
  const exceptionRate = input.exceptionRate ?? 0;
  const incompleteRate = input.incompleteRate ?? 0;
  const successRate = input.commandSuccessRate;

  if (
    timeoutRate >= 0.15 ||
    availability < 0.7 ||
    staleRate >= 0.35 ||
    authRate >= 0.2 ||
    (successRate !== null && input.commandSubmitted >= 3 && successRate < 0.5)
  ) {
    return {
      ...base,
      kind: "HOLD",
      rationale: "availability_stale_auth_or_command_success_pressure",
    };
  }

  if (input.caseInterpreterDiscrepancyCount > 0) {
    return {
      ...base,
      kind: "HOLD",
      rationale: "case_interpreter_discrepancy_requires_review",
    };
  }

  const expansionReady =
    input.requestCount >= minRequests * 3 &&
    input.commandSubmitted >= Math.max(minCommands, 3) &&
    availability >= 0.9 &&
    timeoutRate < 0.05 &&
    staleRate < 0.1 &&
    authRate < 0.05 &&
    exceptionRate < 0.15 &&
    incompleteRate < 0.35 &&
    (successRate === null || successRate >= 0.85);

  if (expansionReady) {
    return {
      ...base,
      kind: "READY_FOR_EXPANSION",
      rationale: "advisory_only_requires_architect_yes_before_any_flag_change",
    };
  }

  return {
    ...base,
    kind: "CONTINUE",
    rationale: "controlled_production_healthy_enough_to_continue_single_tenant",
  };
}
