import type {
  FieldDefinition,
  FieldPolicyEntityState,
  FieldPolicyRule,
  FieldPolicySurface,
} from "../field-policy/types";

export type ExposureDecisionState =
  | "visible"
  | "hidden"
  | "redacted"
  | "summary_only"
  | "blocked";

export type NormalizedExposureTrigger =
  | { readonly kind: "always" }
  | { readonly kind: "event"; readonly name: string }
  | { readonly kind: "relative_time"; readonly anchor: string; readonly offset: string }
  | { readonly kind: "manual"; readonly actorRole?: string };

export type FieldExposureDecisionInput = {
  readonly tenantId?: string;
  readonly workspaceType: string;
  readonly fieldId: string;
  readonly entityState: FieldPolicyEntityState;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: NormalizedExposureTrigger;
  readonly registryField?: {
    readonly exists: boolean;
    readonly tags?: readonly string[];
  };
  readonly fieldPolicy?: {
    readonly surface: FieldPolicySurface;
    readonly definitions: readonly FieldDefinition[];
    readonly rules: readonly FieldPolicyRule[];
  };
  readonly exposureIntent?: {
    readonly mode: "inherit_profile" | "override_fields" | "disabled";
    readonly selectedFieldIds?: readonly string[];
  };
  readonly exposurePolicy?: {
    readonly allowedFieldIds: readonly string[];
    readonly profileId?: string;
  };
};

export type ExposureDecisionLegacyComparison = {
  readonly isPresentInEligibleFields: boolean;
  readonly isPresentInCandidateFields: boolean;
};

export type ExposureDecision = {
  readonly state: ExposureDecisionState;
  readonly reasonChain: readonly string[];
  readonly appliedPolicies: readonly string[];
  /** Shadow-only metadata — not set by the core engine resolver. */
  readonly legacyComparison?: ExposureDecisionLegacyComparison;
};
