import type { ExposureDecision } from "@app-tour/platform-core";

import type { DriftClassification, DriftClassificationType, FieldPolicySnapshot } from "./classify-shadow-drift";
import type { ExposurePolicyHypothesis } from "./infer-exposure-policy-hypothesis";

export type ObservedSystemBiasType =
  | "TELEGRAM_CENTRICITY"
  | "DELIVERABLE_TAG_LEAK"
  | "EVENT_TYPE_OVERLOAD"
  | "FIELD_POLICY_UNDERUSE";

export type ObservedSystemBias = {
  readonly type: ObservedSystemBiasType;
  readonly confidence: number;
};

export type ObservedFieldCluster = {
  readonly clusterId: string;
  readonly fields: readonly string[];
  readonly dominantDriftType: string;
};

export type ObservedExposureModel = {
  readonly surfaces: readonly string[];
  readonly triggers: readonly string[];
  readonly fieldClusters: readonly ObservedFieldCluster[];
  readonly inferredSystemBiases: readonly ObservedSystemBias[];
  readonly coverageGaps: readonly string[];
};

export type ObservedFieldArtifact = {
  readonly fieldId: string;
  readonly driftClassification: DriftClassification | null;
  readonly policyHypothesis: ExposurePolicyHypothesis | null;
  readonly shadowDecision: ExposureDecision;
  readonly legacyEligible: boolean;
  readonly legacyCandidate: boolean;
};

export type ExtractObservedExposureModelInput = {
  readonly surfaces: readonly string[];
  readonly triggers: readonly string[];
  readonly fieldArtifacts: readonly ObservedFieldArtifact[];
  readonly registrySnapshot: readonly {
    readonly fieldId: string;
    readonly exists: boolean;
    readonly tags?: readonly string[];
  }[];
  readonly fieldPolicySnapshot: FieldPolicySnapshot;
  readonly legacyEligibleFieldIds: readonly string[];
  readonly legacyCandidateFieldIds: readonly string[];
};

const DELIVERABLE_TAG = "deliverable";

function dominantDriftTypeForFields(
  artifacts: readonly ObservedFieldArtifact[],
): DriftClassificationType | "NO_DRIFT" {
  const counts = new Map<string, number>();
  for (const artifact of artifacts) {
    const key = artifact.driftClassification?.type ?? "NO_DRIFT";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let winner = "NO_DRIFT";
  let max = 0;
  for (const [type, count] of counts) {
    if (count > max || (count === max && type.localeCompare(winner) < 0)) {
      winner = type;
      max = count;
    }
  }
  return winner as DriftClassificationType | "NO_DRIFT";
}

function buildFieldClusters(artifacts: readonly ObservedFieldArtifact[]): ObservedFieldCluster[] {
  const byDrift = new Map<string, string[]>();

  for (const artifact of artifacts) {
    const driftType = artifact.driftClassification?.type ?? "NO_DRIFT";
    const bucket = byDrift.get(driftType) ?? [];
    bucket.push(artifact.fieldId);
    byDrift.set(driftType, bucket);
  }

  return [...byDrift.entries()]
    .map(([driftType, fields]) => ({
      clusterId: `drift:${driftType}`,
      fields: [...fields].sort((left, right) => left.localeCompare(right)),
      dominantDriftType: driftType,
    }))
    .sort((left, right) => left.clusterId.localeCompare(right.clusterId));
}

function inferSystemBiases(input: ExtractObservedExposureModelInput): ObservedSystemBias[] {
  const biases: ObservedSystemBias[] = [];
  const totalFields = input.fieldArtifacts.length;
  if (totalFields === 0) {
    return biases;
  }

  const driftCounts = new Map<string, number>();
  for (const artifact of input.fieldArtifacts) {
    if (artifact.driftClassification == null) {
      continue;
    }
    driftCounts.set(
      artifact.driftClassification.type,
      (driftCounts.get(artifact.driftClassification.type) ?? 0) + 1,
    );
  }

  const telegramSurfaces = input.surfaces.filter((surface) => surface === "telegram").length;
  if (input.surfaces.length > 0 && telegramSurfaces === input.surfaces.length) {
    biases.push({
      type: "TELEGRAM_CENTRICITY",
      confidence: Math.min(0.95, 0.7 + telegramSurfaces * 0.1),
    });
  }

  const deliverableDrift = driftCounts.get("LEGACY_DELIVERABLE_TAG_DRIVEN") ?? 0;
  if (deliverableDrift > 0) {
    biases.push({
      type: "DELIVERABLE_TAG_LEAK",
      confidence: Math.min(0.95, deliverableDrift / totalFields + 0.35),
    });
  }

  const triggerDrift = driftCounts.get("TRIGGER_MISMATCH") ?? 0;
  if (triggerDrift > 0) {
    biases.push({
      type: "EVENT_TYPE_OVERLOAD",
      confidence: Math.min(0.9, triggerDrift / totalFields + 0.3),
    });
  }

  const policyRuleFieldIds = new Set(
    input.fieldPolicySnapshot.rules.filter((rule) => rule.enabled).map((rule) => rule.fieldId),
  );
  const artifactsWithoutPolicy = input.fieldArtifacts.filter(
    (artifact) => !policyRuleFieldIds.has(artifact.fieldId),
  ).length;
  if (artifactsWithoutPolicy / totalFields >= 0.5) {
    biases.push({
      type: "FIELD_POLICY_UNDERUSE",
      confidence: Math.min(0.92, artifactsWithoutPolicy / totalFields),
    });
  }

  return biases.sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    return left.type.localeCompare(right.type);
  });
}

function buildCoverageGaps(input: ExtractObservedExposureModelInput): string[] {
  const gaps: string[] = [];
  const eligible = new Set(input.legacyEligibleFieldIds);
  const candidate = new Set(input.legacyCandidateFieldIds);
  const deliverableFields = input.registrySnapshot.filter((field) =>
    field.tags?.includes(DELIVERABLE_TAG),
  );

  const shadowOnlyDeliverable = deliverableFields
    .map((field) => field.fieldId)
    .filter((fieldId) => !eligible.has(fieldId) && !candidate.has(fieldId));
  if (shadowOnlyDeliverable.length > 0) {
    gaps.push(
      `deliverable_catalog_fields_not_legacy_selected:${shadowOnlyDeliverable.length}`,
    );
  }

  if (input.surfaces.length === 1 && input.surfaces[0] === "telegram") {
    gaps.push("single_observed_surface:telegram");
  }

  if (input.triggers.length === 1) {
    gaps.push(`single_observed_trigger:${input.triggers[0]}`);
  }

  const mismatchCount = input.fieldArtifacts.filter(
    (artifact) => artifact.driftClassification != null,
  ).length;
  if (mismatchCount > 0) {
    gaps.push(`field_level_mismatch_count:${mismatchCount}`);
  }

  const dominant = dominantDriftTypeForFields(input.fieldArtifacts);
  if (dominant !== "NO_DRIFT") {
    gaps.push(`dominant_drift_cluster:${dominant}`);
  }

  return gaps;
}

/**
 * Aggregates shadow observability artifacts into a structural model summary.
 * Purely analytical — never used for runtime decisions.
 */
export function extractObservedExposureModel(
  input: ExtractObservedExposureModelInput,
): ObservedExposureModel {
  return {
    surfaces: [...new Set(input.surfaces)].sort((left, right) => left.localeCompare(right)),
    triggers: [...new Set(input.triggers)].sort((left, right) => left.localeCompare(right)),
    fieldClusters: buildFieldClusters(input.fieldArtifacts),
    inferredSystemBiases: inferSystemBiases(input),
    coverageGaps: buildCoverageGaps(input),
  };
}
