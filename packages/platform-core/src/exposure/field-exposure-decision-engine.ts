import type { ExposureDecision, FieldExposureDecisionInput } from "./types";
import { resolveFieldState } from "../field-policy/resolve-field-state";

function triggerReason(input: FieldExposureDecisionInput): string {
  if (input.trigger.kind === "event") {
    return `trigger:event:${input.trigger.name}`;
  }
  return `trigger:${input.trigger.kind}`;
}

function decision(input: {
  readonly state: ExposureDecision["state"];
  readonly reasonChain: readonly string[];
  readonly appliedPolicies: readonly string[];
}): ExposureDecision {
  return {
    state: input.state,
    reasonChain: input.reasonChain,
    appliedPolicies: input.appliedPolicies,
  };
}

/**
 * Pure shadow decision engine. Missing snapshots preserve the Phase A/B skeleton behavior;
 * provided snapshots enforce only hard lower bounds.
 */
export function resolveFieldExposureDecision(
  input: FieldExposureDecisionInput,
): ExposureDecision {
  const reasonChain: string[] = [
    `field:${input.fieldId}`,
    `surface:${input.surface}`,
    `audience:${input.audience}`,
    triggerReason(input),
  ];
  const appliedPolicies: string[] = [];

  if (input.registryField === undefined) {
    reasonChain.push("registry_check:pending");
  } else if (!input.registryField.exists) {
    reasonChain.push("registry_check:missing");
    return decision({ state: "hidden", reasonChain, appliedPolicies });
  } else {
    reasonChain.push("registry_check:exists");
  }

  if (input.fieldPolicy === undefined) {
    reasonChain.push("field_policy_check:pending");
  } else {
    const [fieldState] = resolveFieldState({
      tenantId: input.tenantId ?? "shadow",
      workspaceType: input.workspaceType,
      surface: input.fieldPolicy.surface,
      requestedFieldIds: [input.fieldId],
      entityState: input.entityState,
      definitions: input.fieldPolicy.definitions,
      rules: input.fieldPolicy.rules,
    });

    if (fieldState === undefined) {
      reasonChain.push(`field_policy_check:no_state:${input.fieldPolicy.surface}`);
      return decision({ state: "hidden", reasonChain, appliedPolicies });
    }

    reasonChain.push(`field_policy_check:${fieldState.state}:${input.fieldPolicy.surface}`);
    if (fieldState.reasonRuleId != null) {
      appliedPolicies.push(`field_policy:${fieldState.reasonRuleId}`);
    }
    if (fieldState.state === "hidden") {
      return decision({ state: "hidden", reasonChain, appliedPolicies });
    }
  }

  // 3. Exposure policy check (profile-backed restriction snapshot)
  if (input.exposurePolicy === undefined) {
    reasonChain.push("exposure_policy_check:pending");
  } else {
    const allowedFieldIds = new Set(input.exposurePolicy.allowedFieldIds);
    if (!allowedFieldIds.has(input.fieldId)) {
      reasonChain.push("exposure_policy_check:not_allowed");
      if (input.exposurePolicy.profileId != null) {
        appliedPolicies.push(`exposure_profile:${input.exposurePolicy.profileId}`);
      }
      return decision({ state: "hidden", reasonChain, appliedPolicies });
    }

    reasonChain.push("exposure_policy_check:allowed");
    if (input.exposurePolicy.profileId != null) {
      appliedPolicies.push(`exposure_profile:${input.exposurePolicy.profileId}`);
    }
  }

  if (input.exposureIntent != null) {
    reasonChain.push(`exposure_intent_override:${input.exposureIntent.mode}`);
    if (input.exposureIntent.mode === "disabled") {
      appliedPolicies.push("exposure_intent:disabled");
      return decision({ state: "blocked", reasonChain, appliedPolicies });
    }
    if (input.exposureIntent.mode === "override_fields") {
      const selectedFieldIds = input.exposureIntent.selectedFieldIds ?? [];
      if (!selectedFieldIds.includes(input.fieldId)) {
        reasonChain.push("exposure_intent_override:not_selected");
        appliedPolicies.push("exposure_intent:override_not_selected");
        return decision({ state: "hidden", reasonChain, appliedPolicies });
      }
      reasonChain.push("exposure_intent_override:selected");
    }
  }

  return decision({ state: "visible", reasonChain, appliedPolicies });
}
