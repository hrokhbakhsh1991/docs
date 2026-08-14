/**
 * Health → rollout recommendation (PR13-A).
 * Report-only — never mutates env flags or FinanceService paths.
 */

import type { EncounterRolloutHealthReport } from "./encounter-rollout-health";
import type { FinanceCaseEncounterRolloutMode } from "./finance-case-encounter-rollout";

export type EncounterRolloutRecommendationKind =
  | "continue"
  | "expand"
  | "hold"
  | "rollback";

export type EncounterRolloutRecommendation = {
  readonly kind: EncounterRolloutRecommendationKind;
  readonly rationale: string;
  readonly basedOnMode: FinanceCaseEncounterRolloutMode;
  readonly evaluatedAtMs: number;
  /** Hard lock — recommendation never auto-applies flags. */
  readonly mutatesFlags: false;
  readonly blocksFinanceService: false;
};

export type RecommendEncounterRolloutInput = {
  readonly health: EncounterRolloutHealthReport;
  readonly currentMode: FinanceCaseEncounterRolloutMode;
  readonly now?: () => number;
};

/**
 * Derive an operator-facing recommendation from health gates.
 * Callers must apply MODE / HEALTH_HOLD manually — this function is pure.
 */
export function recommendEncounterRollout(
  input: RecommendEncounterRolloutInput
): EncounterRolloutRecommendation {
  const now = input.now ?? Date.now;
  const failGates = input.health.gates.filter((g) => g.status === "fail");
  const warnGates = input.health.gates.filter((g) => g.status === "warn");
  const insufficient = input.health.gates.every((g) => g.status === "insufficient_data");

  if (insufficient || input.health.windowSize === 0) {
    return {
      kind: "hold",
      rationale: "insufficient_telemetry_window",
      basedOnMode: input.currentMode,
      evaluatedAtMs: now(),
      mutatesFlags: false,
      blocksFinanceService: false,
    };
  }

  if (failGates.length >= 2) {
    return {
      kind: "rollback",
      rationale: `multiple_fail_gates:${failGates.map((g) => g.id).join(",")}`,
      basedOnMode: input.currentMode,
      evaluatedAtMs: now(),
      mutatesFlags: false,
      blocksFinanceService: false,
    };
  }

  if (failGates.length === 1) {
    return {
      kind: "hold",
      rationale: `fail_gate:${failGates[0]!.id}`,
      basedOnMode: input.currentMode,
      evaluatedAtMs: now(),
      mutatesFlags: false,
      blocksFinanceService: false,
    };
  }

  if (warnGates.length > 0) {
    return {
      kind: "continue",
      rationale: `warn_gates:${warnGates.map((g) => g.id).join(",")}`,
      basedOnMode: input.currentMode,
      evaluatedAtMs: now(),
      mutatesFlags: false,
      blocksFinanceService: false,
    };
  }

  if (
    input.currentMode === "pilot" ||
    input.currentMode === "internal" ||
    input.currentMode === "sampled" ||
    input.currentMode === "disabled"
  ) {
    return {
      kind: "expand",
      rationale: "all_gates_pass",
      basedOnMode: input.currentMode,
      evaluatedAtMs: now(),
      mutatesFlags: false,
      blocksFinanceService: false,
    };
  }

  return {
    kind: "continue",
    rationale: "all_gates_pass_full",
    basedOnMode: input.currentMode,
    evaluatedAtMs: now(),
    mutatesFlags: false,
    blocksFinanceService: false,
  };
}
