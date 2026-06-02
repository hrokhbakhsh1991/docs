/**
 * Phase 4 step 2: canonical rule source prepared but not activated.
 *
 * Resolves {@link denaliRuleSet} from {@link DenaliCanonicalTourModel} using only
 * `category` and `duration` — no `denaliTourKind`, `basicInfo.tourType`, or `isMultiDay`.
 */

import type {
  DenaliCanonicalDuration,
  DenaliCanonicalTourModel,
} from "@repo/types/denali";

import {
  denaliRuleSet,
  type DenaliRuleModel,
  type DenaliRuleModelCategory,
  type DenaliRuleModelDuration,
} from "./denaliRuleModel";

/** Map canonical `single` | `multi` → rule-set `single_day` | `multi_day`. */
export function canonicalDurationToRuleModelDuration(
  duration: DenaliCanonicalDuration,
): DenaliRuleModelDuration {
  return duration === "multi" ? "multi_day" : "single_day";
}

/** Map rule-set duration → canonical tokens (for adapters/tests). */
export function ruleModelDurationToCanonicalDuration(
  duration: DenaliRuleModelDuration,
): DenaliCanonicalDuration {
  return duration === "multi_day" ? "multi" : "single";
}

/**
 * Rule model for the canonical classification slice only.
 * Returns `null` when the combination is not product-allowed (e.g. event + multi).
 */
export function getDenaliRulesFromCanonical(
  model: Pick<DenaliCanonicalTourModel, "category" | "duration">,
  ruleSet: typeof denaliRuleSet = denaliRuleSet,
): DenaliRuleModel | null {
  const category = model.category as DenaliRuleModelCategory;
  const duration = canonicalDurationToRuleModelDuration(model.duration);
  return ruleSet[category][duration];
}
