import type { ExposureDecision } from "@app-tour/platform-core";

import type {
  DriftClassification,
  DriftClassificationType,
  FieldPolicySnapshot,
  RegistryFieldSnapshot,
} from "./classify-shadow-drift";

export type InferredPolicyType =
  | "SURFACE_RULE"
  | "TRIGGER_RULE"
  | "FIELD_REGISTRY_CONSTRAINT"
  | "FIELD_POLICY_CONSTRAINT"
  | "DELIVERABLE_LEGACY_LEAK"
  | "UNKNOWN";

export type SuggestedRuleShape = {
  readonly surface?: string;
  readonly audience?: string;
  readonly trigger?: string;
  readonly state?: string;
};

export type ExposurePolicyHypothesis = {
  readonly inferredPolicyType: InferredPolicyType;
  readonly suggestedRuleShape: SuggestedRuleShape;
  readonly confidence: number;
  readonly explanationChain: readonly string[];
};

export type InferExposurePolicyHypothesisInput = {
  readonly fieldId: string;
  readonly legacyEligible: boolean;
  readonly legacyCandidate: boolean;
  readonly shadowDecision: ExposureDecision;
  readonly driftClassification: DriftClassification | null;
  readonly registrySnapshot: RegistryFieldSnapshot | null;
  readonly fieldPolicySnapshot: FieldPolicySnapshot;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
};

const DRIFT_TO_POLICY_TYPE: Readonly<Record<DriftClassificationType, InferredPolicyType>> = {
  SURFACE_MISMATCH: "SURFACE_RULE",
  TRIGGER_MISMATCH: "TRIGGER_RULE",
  REGISTRY_DRIVEN: "FIELD_REGISTRY_CONSTRAINT",
  FIELD_POLICY_DRIVEN: "FIELD_POLICY_CONSTRAINT",
  LEGACY_DELIVERABLE_TAG_DRIVEN: "DELIVERABLE_LEGACY_LEAK",
  UNKNOWN: "UNKNOWN",
};

function legacyObservedState(input: InferExposurePolicyHypothesisInput): string {
  if (input.legacyEligible) {
    return "visible";
  }
  if (input.legacyCandidate) {
    return "candidate_only";
  }
  return "excluded";
}

function fieldPolicySurfacesForField(input: InferExposurePolicyHypothesisInput): readonly string[] {
  return [
    ...new Set(
      input.fieldPolicySnapshot.rules
        .filter((rule) => rule.fieldId === input.fieldId && rule.enabled)
        .map((rule) => rule.surface),
    ),
  ].sort();
}

function buildSuggestedRuleShape(input: InferExposurePolicyHypothesisInput): SuggestedRuleShape {
  const policyType =
    input.driftClassification === null
      ? "UNKNOWN"
      : DRIFT_TO_POLICY_TYPE[input.driftClassification.type];

  switch (policyType) {
    case "SURFACE_RULE": {
      const policySurfaces = fieldPolicySurfacesForField(input);
      return {
        surface: policySurfaces[0] ?? input.surface,
        audience: input.audience,
        trigger: input.trigger,
        state: legacyObservedState(input),
      };
    }
    case "TRIGGER_RULE":
      return {
        surface: input.surface,
        audience: input.audience,
        trigger: input.trigger,
        state: legacyObservedState(input),
      };
    case "FIELD_REGISTRY_CONSTRAINT":
      return {
        ...(input.registrySnapshot?.tags?.includes("deliverable")
          ? { state: "catalog_deliverable" }
          : { state: "registry_gated" }),
      };
    case "FIELD_POLICY_CONSTRAINT": {
      const restrictiveRule = input.fieldPolicySnapshot.rules.find(
        (rule) =>
          rule.fieldId === input.fieldId &&
          rule.enabled &&
          (rule.state === "hidden" || rule.state === "readonly"),
      );
      return {
        surface: restrictiveRule?.surface ?? input.surface,
        audience: input.audience,
        trigger: input.trigger,
        state: restrictiveRule?.state ?? "hidden",
      };
    }
    case "DELIVERABLE_LEGACY_LEAK":
      return {
        surface: input.surface,
        audience: input.audience,
        trigger: input.trigger,
        state: input.shadowDecision.state,
      };
    default:
      return {
        surface: input.surface,
        audience: input.audience,
        trigger: input.trigger,
        state: legacyObservedState(input),
      };
  }
}

function buildExplanationChain(input: InferExposurePolicyHypothesisInput): string[] {
  const chain: string[] = [
    "hypothesis:non_authoritative",
    `field:${input.fieldId}`,
    `legacy_observed:${legacyObservedState(input)}`,
    `shadow_state:${input.shadowDecision.state}`,
  ];

  if (input.driftClassification != null) {
    chain.push(`drift:${input.driftClassification.type}`);
    chain.push(...input.driftClassification.explanationChain.map((line) => `drift_detail:${line}`));
  }

  chain.push("reverse_engineered_from_observed_behavior_not_asserted_truth");
  return chain;
}

/**
 * Reverse-compiles drift signals into a hypothetical exposure policy shape.
 * Observational only — never used for runtime decisions.
 */
export function inferExposurePolicyHypothesis(
  input: InferExposurePolicyHypothesisInput,
): ExposurePolicyHypothesis | null {
  if (input.driftClassification === null) {
    return null;
  }

  const inferredPolicyType = DRIFT_TO_POLICY_TYPE[input.driftClassification.type];
  const suggestedRuleShape = buildSuggestedRuleShape(input);
  const confidence = Math.min(
    0.99,
    Math.max(0.35, input.driftClassification.confidence * 0.92),
  );

  return {
    inferredPolicyType,
    suggestedRuleShape,
    confidence,
    explanationChain: buildExplanationChain(input),
  };
}
