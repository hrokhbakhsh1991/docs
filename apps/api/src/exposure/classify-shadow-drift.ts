import type { ExposureDecision } from "@app-tour/platform-core";

import type { ShadowParityMismatchType } from "./compare-shadow-vs-legacy";

export type DriftClassificationType =
  | "REGISTRY_DRIVEN"
  | "FIELD_POLICY_DRIVEN"
  | "SURFACE_MISMATCH"
  | "TRIGGER_MISMATCH"
  | "LEGACY_DELIVERABLE_TAG_DRIVEN"
  | "UNKNOWN";

export type DriftClassification = {
  readonly type: DriftClassificationType;
  readonly confidence: number;
  readonly explanationChain: readonly string[];
};

export type RegistryFieldSnapshot = {
  readonly fieldId: string;
  readonly exists: boolean;
  readonly tags?: readonly string[];
};

export type FieldPolicyRuleSnapshot = {
  readonly id: string;
  readonly fieldId: string;
  readonly surface: string;
  readonly state: string;
  readonly enabled: boolean;
};

export type FieldPolicySnapshot = {
  readonly rules: readonly FieldPolicyRuleSnapshot[];
};

export type ClassifyShadowDriftInput = {
  readonly fieldId: string;
  readonly legacyEligibleFieldIds: readonly string[];
  readonly legacyCandidateFieldIds: readonly string[];
  readonly shadowDecision: ExposureDecision;
  readonly registryField: RegistryFieldSnapshot | null;
  readonly fieldPolicy: FieldPolicySnapshot;
  readonly mismatch: ShadowParityMismatchType | null;
  readonly shadowSurface: string;
  readonly normalizedTriggerName: string;
  readonly rawEventType: string;
};

const DELIVERABLE_TAG = "deliverable";

function hasTag(tags: readonly string[] | undefined, tag: string): boolean {
  return tags?.includes(tag) === true;
}

function classifyFieldPolicyDrift(input: ClassifyShadowDriftInput): DriftClassification | null {
  const fieldRules = input.fieldPolicy.rules.filter(
    (rule) => rule.fieldId === input.fieldId && rule.enabled,
  );
  const isCandidate = input.legacyCandidateFieldIds.includes(input.fieldId);
  const isEligible = input.legacyEligibleFieldIds.includes(input.fieldId);

  if (isCandidate && !isEligible && fieldRules.length > 0) {
    const hidingRule = fieldRules.find((rule) => rule.state === "hidden");
    return {
      type: "FIELD_POLICY_DRIVEN",
      confidence: hidingRule === undefined ? 0.72 : 0.9,
      explanationChain: [
        "legacy_candidate_without_eligibility",
        hidingRule === undefined
          ? "field_policy_rules_present_no_eligible_match"
          : `field_policy_hidden_rule:${hidingRule.id}`,
      ],
    };
  }

  if (
    input.mismatch === "FIELD_EXTRA" &&
    fieldRules.some((rule) => rule.state === "hidden" || rule.state === "readonly")
  ) {
    return {
      type: "FIELD_POLICY_DRIVEN",
      confidence: 0.88,
      explanationChain: [
        "legacy_eligible_shadow_restricted",
        "field_policy_restrictive_rules_present",
      ],
    };
  }

  return null;
}

function classifySurfaceDrift(input: ClassifyShadowDriftInput): DriftClassification | null {
  const fieldRules = input.fieldPolicy.rules.filter(
    (rule) => rule.fieldId === input.fieldId && rule.enabled,
  );
  if (fieldRules.length === 0) {
    return null;
  }

  const surfaces = new Set(fieldRules.map((rule) => rule.surface));
  const matchesShadowSurface = surfaces.has(input.shadowSurface);
  const usesDeliverySurface = surfaces.has("delivery");

  if (!matchesShadowSurface && (usesDeliverySurface || surfaces.size > 0)) {
    return {
      type: "SURFACE_MISMATCH",
      confidence: usesDeliverySurface ? 0.82 : 0.74,
      explanationChain: [
        `shadow_surface:${input.shadowSurface}`,
        `field_policy_surfaces:${[...surfaces].sort().join(",")}`,
        usesDeliverySurface ? "legacy_delivery_surface_semantics" : "surface_axis_not_aligned",
      ],
    };
  }

  return null;
}

function classifyDeliverableTagDrift(input: ClassifyShadowDriftInput): DriftClassification | null {
  if (input.registryField == null || !input.registryField.exists) {
    return null;
  }

  const isDeliverable = hasTag(input.registryField.tags, DELIVERABLE_TAG);
  const isCandidate = input.legacyCandidateFieldIds.includes(input.fieldId);
  const isEligible = input.legacyEligibleFieldIds.includes(input.fieldId);

  if (
    isDeliverable &&
    input.mismatch === "FIELD_MISSING" &&
    !isCandidate &&
    !isEligible
  ) {
    return {
      type: "LEGACY_DELIVERABLE_TAG_DRIVEN",
      confidence: 0.86,
      explanationChain: [
        "registry_deliverable_tag_present",
        "legacy_did_not_select_field",
        "shadow_evaluates_full_deliverable_catalog",
      ],
    };
  }

  return null;
}

function classifyRegistryDrift(input: ClassifyShadowDriftInput): DriftClassification | null {
  if (input.registryField == null || !input.registryField.exists) {
    return {
      type: "REGISTRY_DRIVEN",
      confidence: 0.95,
      explanationChain: ["field_not_in_registry_snapshot"],
    };
  }

  if (
    input.mismatch !== null &&
    !hasTag(input.registryField.tags, DELIVERABLE_TAG) &&
    input.legacyCandidateFieldIds.includes(input.fieldId)
  ) {
    return {
      type: "REGISTRY_DRIVEN",
      confidence: 0.78,
      explanationChain: [
        "legacy_selected_non_deliverable_registry_field",
        "registry_tag_semantics_diverge_from_shadow_catalog",
      ],
    };
  }

  return null;
}

function classifyTriggerDrift(input: ClassifyShadowDriftInput): DriftClassification | null {
  if (input.rawEventType.trim() !== input.normalizedTriggerName) {
    return {
      type: "TRIGGER_MISMATCH",
      confidence: 0.65,
      explanationChain: [
        `raw_event_type:${input.rawEventType}`,
        `normalized_trigger:${input.normalizedTriggerName}`,
        "legacy_uses_integration_event_type_directly",
      ],
    };
  }

  return null;
}

function pickStrongestClassification(
  candidates: readonly DriftClassification[],
): DriftClassification {
  if (candidates.length === 0) {
    return {
      type: "UNKNOWN",
      confidence: 0.4,
      explanationChain: ["no_matching_drift_hypothesis"],
    };
  }

  return [...candidates].sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return left.type.localeCompare(right.type);
  })[0]!;
}

/**
 * Read-only drift hypothesis for shadow parity mismatches.
 * Does not mutate decisions or parity outcomes.
 */
export function classifyShadowDrift(input: ClassifyShadowDriftInput): DriftClassification | null {
  if (input.mismatch === null) {
    return null;
  }

  const candidates: DriftClassification[] = [];

  const registry = classifyRegistryDrift(input);
  if (registry !== null) {
    candidates.push(registry);
  }

  const fieldPolicy = classifyFieldPolicyDrift(input);
  if (fieldPolicy !== null) {
    candidates.push(fieldPolicy);
  }

  const deliverable = classifyDeliverableTagDrift(input);
  if (deliverable !== null) {
    candidates.push(deliverable);
  }

  const surface = classifySurfaceDrift(input);
  if (surface !== null) {
    candidates.push(surface);
  }

  const trigger = classifyTriggerDrift(input);
  if (trigger !== null) {
    candidates.push(trigger);
  }

  const strongest = pickStrongestClassification(candidates);
  const explanationChain = [
    `mismatch:${input.mismatch}`,
    ...strongest.explanationChain,
    ...candidates
      .filter((candidate) => candidate.type !== strongest.type)
      .flatMap((candidate) =>
        candidate.explanationChain.map((line) => `secondary_${candidate.type}:${line}`),
      ),
  ];

  return {
    type: strongest.type,
    confidence: strongest.confidence,
    explanationChain,
  };
}
