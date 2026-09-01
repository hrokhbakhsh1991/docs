import { DENALI_WORKSPACE_TYPE } from "@app-tour/workspace-denali";
import {
  assertDenaliWorkspaceOwner,
  DenaliTourMutationBlockedError,
  DenaliTourMutationOverrideRequiredError,
  evaluateDenaliTourMutation,
  readDenaliTransportAllocationsLocked,
  type DenaliTourMutationDecision,
  type DenaliTourMutationSideEffect,
} from "../workspace/denali-host-legacy-bindings.generated.ts";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { TourMutationFacts } from "./resolve-tour-mutation-facts";

export type AssertWorkspaceTourMutationPolicyInput = {
  readonly workspaceType: string;
  readonly auth: TenantAuthContext;
  readonly beforeData: Record<string, unknown>;
  readonly afterData: Record<string, unknown>;
  readonly facts: TourMutationFacts;
  readonly operatorMutationOverride?: boolean;
};

export type WorkspaceTourMutationPolicyResult = {
  readonly decision: DenaliTourMutationDecision;
  readonly sideEffects: readonly DenaliTourMutationSideEffect[];
};

export function assertWorkspaceTourMutationPolicy(
  input: AssertWorkspaceTourMutationPolicyInput
): WorkspaceTourMutationPolicyResult {
  if (input.workspaceType !== DENALI_WORKSPACE_TYPE) {
    return { decision: { decision: "ALLOW" }, sideEffects: [] };
  }

  if (input.operatorMutationOverride === true) {
    assertDenaliWorkspaceOwner({
      auth: input.auth,
      workspaceType: input.workspaceType,
      surface: "denali.tour.mutation_override",
    });
  }

  const facts = {
    ...input.facts,
    hasTransportAllocations:
      input.facts.hasTransportAllocations ||
      readDenaliTransportAllocationsLocked(input.beforeData) ||
      readDenaliTransportAllocationsLocked(input.afterData),
  };

  const decision = evaluateDenaliTourMutation({
    beforeData: input.beforeData,
    afterData: input.afterData,
    facts,
    operatorMutationOverride: input.operatorMutationOverride,
    operatorIsOwner: input.auth.role === "owner",
  });

  if (decision.decision === "DENY") {
    throw new DenaliTourMutationBlockedError({
      reasonCode: decision.reasonCode,
      fields: decision.fields,
      message: decision.message,
    });
  }

  if (decision.decision === "REQUIRE_OVERRIDE") {
    throw new DenaliTourMutationOverrideRequiredError({
      reasonCode: decision.reasonCode,
      fields: decision.fields,
      message: decision.message,
    });
  }

  if (decision.decision === "ALLOW_WITH_SIDE_EFFECT") {
    return { decision, sideEffects: decision.sideEffects };
  }

  return { decision, sideEffects: [] };
}
