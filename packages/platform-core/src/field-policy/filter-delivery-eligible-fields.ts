import type { FieldPolicyEntityState } from "./entity-state";
import { resolveFieldState } from "./resolve-field-state";
import type { FieldDefinition, FieldPolicyRule, FieldPolicySurface } from "./types";

export type FilterDeliveryEligibleFieldsInput = {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly exposureSurface: string;
  readonly candidateFieldIds: readonly string[];
  readonly entityState: FieldPolicyEntityState;
  readonly definitions: readonly FieldDefinition[];
  readonly rules: readonly FieldPolicyRule[];
};

/**
 * Provider-agnostic exposure eligibility filter using an explicit ExposureSurface
 * (e.g. `telegram`), not the legacy ambiguous `delivery` surface name.
 */
export function filterDeliveryEligibleFields(
  input: FilterDeliveryEligibleFieldsInput,
): readonly string[] {
  const uniqueCandidates = [...new Set(input.candidateFieldIds.filter((id) => id.length > 0))];
  if (uniqueCandidates.length === 0) {
    return [];
  }

  const resolved = resolveFieldState({
    tenantId: input.tenantId,
    workspaceType: input.workspaceType,
    surface: input.exposureSurface as FieldPolicySurface,
    requestedFieldIds: uniqueCandidates,
    entityState: input.entityState,
    definitions: input.definitions,
    rules: input.rules,
  });

  const eligible = new Set(
    resolved.filter((entry) => entry.state !== "hidden").map((entry) => entry.fieldId),
  );

  return uniqueCandidates.filter((fieldId) => eligible.has(fieldId));
}
