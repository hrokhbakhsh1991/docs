import { defineWorkspaceCodedError } from "@app-tour/workspace-sdk";

import type { DenaliTourMutationReasonCode } from "../../tours/tour-mutation-policy";

const blocked = defineWorkspaceCodedError({
  code: "DENALI_TOUR_MUTATION_BLOCKED",
  name: "DenaliTourMutationBlockedError",
  httpStatus: 409,
});

const overrideRequired = defineWorkspaceCodedError({
  code: "DENALI_TOUR_MUTATION_OVERRIDE_REQUIRED",
  name: "DenaliTourMutationOverrideRequiredError",
  httpStatus: 409,
});

export const DENALI_TOUR_MUTATION_BLOCKED = blocked.code as "DENALI_TOUR_MUTATION_BLOCKED";
export const DENALI_TOUR_MUTATION_OVERRIDE_REQUIRED =
  overrideRequired.code as "DENALI_TOUR_MUTATION_OVERRIDE_REQUIRED";

export type DenaliTourMutationErrorDetails = {
  readonly reasonCode: DenaliTourMutationReasonCode;
  readonly fields: readonly string[];
  readonly message: string;
};

export class DenaliTourMutationBlockedError extends blocked.ErrorClass {
  readonly reasonCode: DenaliTourMutationReasonCode;
  readonly fields: readonly string[];
  readonly detailMessage: string;

  constructor(details: DenaliTourMutationErrorDetails) {
    super();
    this.reasonCode = details.reasonCode;
    this.fields = details.fields;
    this.detailMessage = details.message;
    this.message = details.message;
  }
}

export class DenaliTourMutationOverrideRequiredError extends overrideRequired.ErrorClass {
  readonly reasonCode: DenaliTourMutationReasonCode;
  readonly fields: readonly string[];
  readonly detailMessage: string;

  constructor(details: DenaliTourMutationErrorDetails) {
    super();
    this.reasonCode = details.reasonCode;
    this.fields = details.fields;
    this.detailMessage = details.message;
    this.message = details.message;
  }
}

export function isDenaliTourMutationBlockedError(
  error: unknown
): error is DenaliTourMutationBlockedError {
  return error instanceof DenaliTourMutationBlockedError || blocked.isError(error);
}

export function isDenaliTourMutationOverrideRequiredError(
  error: unknown
): error is DenaliTourMutationOverrideRequiredError {
  return (
    error instanceof DenaliTourMutationOverrideRequiredError || overrideRequired.isError(error)
  );
}

export function isDenaliTourMutationPolicyError(
  error: unknown
): error is DenaliTourMutationBlockedError | DenaliTourMutationOverrideRequiredError {
  return isDenaliTourMutationBlockedError(error) || isDenaliTourMutationOverrideRequiredError(error);
}
