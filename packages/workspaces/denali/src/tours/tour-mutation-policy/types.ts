export type DenaliTourMutationFieldClass =
  | "SAFE_MUTABLE"
  | "FROZEN_AFTER_REGISTRATION"
  | "FROZEN_AFTER_APPROVAL"
  | "FROZEN_AFTER_PAYMENT"
  | "MUTABLE_WITH_NOTIFICATION"
  | "MUTABLE_WITH_REPRICING"
  | "REQUIRES_OPERATOR_OVERRIDE";

export type DenaliTourMutationSideEffectKind =
  | "notification_required"
  | "repricing_required"
  | "transport_review_required";

export type DenaliTourMutationSideEffect = {
  readonly kind: DenaliTourMutationSideEffectKind;
  readonly fields: readonly string[];
};

export type DenaliTourOperationalFacts = {
  readonly activeRegistrationCount: number;
  readonly approvedRegistrationCount: number;
  readonly paidRegistrationCount: number;
  readonly occupiedApprovedPartySize: number;
  readonly hasTransportAllocations: boolean;
};

export type DenaliTourMutationReasonCode =
  | "NO_ACTIVE_REGISTRATIONS"
  | "FIELD_FROZEN_AFTER_REGISTRATION"
  | "FIELD_FROZEN_AFTER_APPROVAL"
  | "FIELD_FROZEN_AFTER_PAYMENT"
  | "CAPACITY_BELOW_OCCUPIED"
  | "OPERATOR_OVERRIDE_REQUIRED"
  | "TRANSPORT_ALLOCATIONS_LOCKED";

export type DenaliTourMutationDecision =
  | { readonly decision: "ALLOW" }
  | {
      readonly decision: "DENY";
      readonly reasonCode: DenaliTourMutationReasonCode;
      readonly fields: readonly string[];
      readonly message: string;
    }
  | {
      readonly decision: "REQUIRE_OVERRIDE";
      readonly reasonCode: DenaliTourMutationReasonCode;
      readonly fields: readonly string[];
      readonly message: string;
    }
  | {
      readonly decision: "ALLOW_WITH_SIDE_EFFECT";
      readonly sideEffects: readonly DenaliTourMutationSideEffect[];
      readonly fields: readonly string[];
    };

export type DenaliTourMutationEvaluationInput = {
  readonly beforeData: Record<string, unknown>;
  readonly afterData: Record<string, unknown>;
  readonly facts: DenaliTourOperationalFacts;
  readonly operatorMutationOverride?: boolean;
  readonly operatorIsOwner?: boolean;
};
