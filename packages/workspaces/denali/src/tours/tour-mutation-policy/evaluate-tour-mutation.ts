import { DENALI_TOUR_MUTATION_FIELD_BINDINGS } from "./field-matrix";
import {
  listDenaliTourMutationChangedFields,
  readDenaliCapacityMax,
  readDenaliTransportAllocationsLocked,
} from "./diff-changed-fields";
import type {
  DenaliTourMutationDecision,
  DenaliTourMutationEvaluationInput,
  DenaliTourMutationFieldClass,
  DenaliTourMutationReasonCode,
  DenaliTourMutationSideEffect,
} from "./types";

const BINDING_BY_PATH = new Map(
  DENALI_TOUR_MUTATION_FIELD_BINDINGS.map((binding) => [binding.canonicalPath, binding] as const)
);

export function evaluateDenaliTourMutation(
  input: DenaliTourMutationEvaluationInput
): DenaliTourMutationDecision {
  if (input.facts.activeRegistrationCount <= 0) {
    return { decision: "ALLOW" };
  }

  const changedFields = listDenaliTourMutationChangedFields({
    beforeData: input.beforeData,
    afterData: input.afterData,
  });
  if (changedFields.length === 0) {
    return { decision: "ALLOW" };
  }

  const hasTransportAllocations =
    input.facts.hasTransportAllocations ||
    readDenaliTransportAllocationsLocked(input.beforeData) ||
    readDenaliTransportAllocationsLocked(input.afterData);

  const denials: Array<{
    readonly reasonCode: DenaliTourMutationReasonCode;
    readonly fields: readonly string[];
    readonly message: string;
  }> = [];
  const overrideRequired: Array<{
    readonly reasonCode: DenaliTourMutationReasonCode;
    readonly fields: readonly string[];
    readonly message: string;
  }> = [];
  const sideEffects: DenaliTourMutationSideEffect[] = [];
  const sideEffectFields: string[] = [];

  for (const field of changedFields) {
    const binding = BINDING_BY_PATH.get(field);
    if (binding === undefined) {
      continue;
    }

    const capacityOutcome = evaluateCapacityChange(field, input);
    if (field === "capacityMax") {
      if (capacityOutcome !== null) {
        if (capacityOutcome.decision === "DENY") {
          denials.push(capacityOutcome);
        } else if (capacityOutcome.decision === "REQUIRE_OVERRIDE") {
          if (input.operatorMutationOverride === true && input.operatorIsOwner === true) {
            // owner override allows decrease above occupied floor
          } else {
            overrideRequired.push(capacityOutcome);
          }
        }
      }
      continue;
    }

    if (
      binding.mutationClass === "REQUIRES_OPERATOR_OVERRIDE" &&
      field.startsWith("transport.")
    ) {
      if (!hasTransportAllocations) {
        continue;
      }
      const blocked = {
        reasonCode: "TRANSPORT_ALLOCATIONS_LOCKED" as const,
        fields: [field],
        message: `Transport field ${field} cannot change while passenger allocations exist`,
      };
      if (input.operatorMutationOverride === true && input.operatorIsOwner === true) {
        sideEffects.push({ kind: "transport_review_required", fields: [field] });
        sideEffectFields.push(field);
      } else {
        overrideRequired.push(blocked);
      }
      continue;
    }

    const classOutcome = evaluateFieldClass(binding.mutationClass, field, input);
    if (classOutcome === null) {
      continue;
    }

    if (classOutcome.decision === "DENY") {
      denials.push(classOutcome);
    } else if (classOutcome.decision === "REQUIRE_OVERRIDE") {
      if (input.operatorMutationOverride === true && input.operatorIsOwner === true) {
        if (classOutcome.sideEffect != null) {
          sideEffects.push(classOutcome.sideEffect);
          sideEffectFields.push(field);
        }
      } else {
        overrideRequired.push(classOutcome);
      }
    } else if (classOutcome.decision === "ALLOW_WITH_SIDE_EFFECT" && classOutcome.sideEffect) {
      sideEffects.push(classOutcome.sideEffect);
      sideEffectFields.push(field);
    }
  }

  if (denials.length > 0) {
    return {
      decision: "DENY",
      reasonCode: denials[0]!.reasonCode,
      fields: denials.flatMap((entry) => entry.fields),
      message: denials[0]!.message,
    };
  }

  if (overrideRequired.length > 0) {
    return {
      decision: "REQUIRE_OVERRIDE",
      reasonCode: overrideRequired[0]!.reasonCode,
      fields: overrideRequired.flatMap((entry) => entry.fields),
      message: overrideRequired[0]!.message,
    };
  }

  if (sideEffects.length > 0) {
    return {
      decision: "ALLOW_WITH_SIDE_EFFECT",
      sideEffects: Object.freeze(sideEffects),
      fields: Object.freeze(sideEffectFields),
    };
  }

  return { decision: "ALLOW" };
}

type FieldClassOutcome =
  | null
  | {
      readonly decision: "DENY" | "REQUIRE_OVERRIDE";
      readonly reasonCode: DenaliTourMutationReasonCode;
      readonly fields: readonly string[];
      readonly message: string;
      readonly sideEffect?: DenaliTourMutationSideEffect;
    }
  | {
      readonly decision: "ALLOW_WITH_SIDE_EFFECT";
      readonly sideEffect: DenaliTourMutationSideEffect;
    };

function evaluateFieldClass(
  mutationClass: DenaliTourMutationFieldClass,
  field: string,
  input: DenaliTourMutationEvaluationInput
): FieldClassOutcome {
  const facts = input.facts;

  switch (mutationClass) {
    case "SAFE_MUTABLE":
      return null;
    case "FROZEN_AFTER_REGISTRATION":
      if (facts.activeRegistrationCount > 0) {
        return {
          decision: "DENY",
          reasonCode: "FIELD_FROZEN_AFTER_REGISTRATION",
          fields: [field],
          message: `Field ${field} is frozen after registrations exist`,
        };
      }
      return null;
    case "FROZEN_AFTER_APPROVAL":
      if (facts.approvedRegistrationCount > 0) {
        return {
          decision: "DENY",
          reasonCode: "FIELD_FROZEN_AFTER_APPROVAL",
          fields: [field],
          message: `Field ${field} is frozen after registrations are approved`,
        };
      }
      return null;
    case "FROZEN_AFTER_PAYMENT":
      if (facts.paidRegistrationCount > 0) {
        return {
          decision: "DENY",
          reasonCode: "FIELD_FROZEN_AFTER_PAYMENT",
          fields: [field],
          message: `Field ${field} is frozen after payments exist`,
        };
      }
      return null;
    case "MUTABLE_WITH_NOTIFICATION":
      if (facts.activeRegistrationCount > 0) {
        return {
          decision: "ALLOW_WITH_SIDE_EFFECT",
          sideEffect: { kind: "notification_required", fields: [field] },
        };
      }
      return null;
    case "MUTABLE_WITH_REPRICING":
      if (facts.paidRegistrationCount > 0) {
        return {
          decision: "DENY",
          reasonCode: "FIELD_FROZEN_AFTER_PAYMENT",
          fields: [field],
          message: `Field ${field} cannot change after payments exist`,
        };
      }
      if (facts.approvedRegistrationCount > 0) {
        return {
          decision: "ALLOW_WITH_SIDE_EFFECT",
          sideEffect: { kind: "repricing_required", fields: [field] },
        };
      }
      return null;
    case "REQUIRES_OPERATOR_OVERRIDE":
      if (facts.activeRegistrationCount > 0) {
        return {
          decision: "REQUIRE_OVERRIDE",
          reasonCode: "OPERATOR_OVERRIDE_REQUIRED",
          fields: [field],
          message: `Field ${field} requires workspace owner override`,
        };
      }
      return null;
    default:
      return null;
  }
}

function evaluateCapacityChange(
  field: string,
  input: DenaliTourMutationEvaluationInput
):
  | null
  | {
      readonly decision: "DENY" | "REQUIRE_OVERRIDE";
      readonly reasonCode: DenaliTourMutationReasonCode;
      readonly fields: readonly string[];
      readonly message: string;
    } {
  if (field !== "capacityMax") {
    return null;
  }

  const before = readDenaliCapacityMax(input.beforeData);
  const after = readDenaliCapacityMax(input.afterData);
  if (before === undefined || after === undefined || after >= before) {
    return null;
  }

  if (after < input.facts.occupiedApprovedPartySize) {
    return {
      decision: "DENY",
      reasonCode: "CAPACITY_BELOW_OCCUPIED",
      fields: [field],
      message: `capacityMax ${after} is below occupied approved party size ${input.facts.occupiedApprovedPartySize}`,
    };
  }

  return {
    decision: "REQUIRE_OVERRIDE",
    reasonCode: "OPERATOR_OVERRIDE_REQUIRED",
    fields: [field],
    message: "Reducing capacity after registrations requires workspace owner override",
  };
}
