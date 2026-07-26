import { formatIntegrationDeliveryMessage } from "../integrations/platform/format-integration-delivery-message";

export type ShadowRenderedParity = {
  readonly matches: boolean;
  readonly mismatches: readonly string[];
};

export function buildIntegrationDeliveryRenderPayload(input: {
  readonly basePayload: Record<string, unknown>;
  readonly candidateFieldIds: readonly string[];
  readonly eligibleFieldIds: readonly string[];
  readonly fieldValues: Readonly<Record<string, string>>;
  readonly messageTemplate: string | null;
}): Record<string, unknown> {
  return {
    ...input.basePayload,
    integrationDeliveryCandidateFieldIds: input.candidateFieldIds,
    integrationDeliveryFieldIds: input.eligibleFieldIds,
    integrationDeliveryFieldValues: input.fieldValues,
    ...(input.messageTemplate === null
      ? {}
      : { integrationDeliveryMessageTemplate: input.messageTemplate }),
  };
}

/**
 * Phase 3 rendered-template parity — shadow render vs authoritative delivery render.
 */
export async function resolveShadowRenderedDeliveryParity(input: {
  readonly workspaceType: string | null;
  readonly eventType: string;
  readonly basePayload: Record<string, unknown>;
  readonly shadowFields: {
    readonly candidateFieldIds: readonly string[];
    readonly eligibleFieldIds: readonly string[];
    readonly fieldValues: Readonly<Record<string, string>>;
    readonly messageTemplate: string | null;
  };
  readonly authoritativeFields: {
    readonly candidateFieldIds: readonly string[];
    readonly eligibleFieldIds: readonly string[];
    readonly fieldValues: Readonly<Record<string, string>>;
    readonly messageTemplate: string | null;
  };
}): Promise<{
  readonly renderedMessage: string;
  readonly renderedParity: ShadowRenderedParity;
}> {
  const shadowPayload = buildIntegrationDeliveryRenderPayload({
    basePayload: input.basePayload,
    candidateFieldIds: input.shadowFields.candidateFieldIds,
    eligibleFieldIds: input.shadowFields.eligibleFieldIds,
    fieldValues: input.shadowFields.fieldValues,
    messageTemplate: input.shadowFields.messageTemplate,
  });
  const authoritativePayload = buildIntegrationDeliveryRenderPayload({
    basePayload: input.basePayload,
    candidateFieldIds: input.authoritativeFields.candidateFieldIds,
    eligibleFieldIds: input.authoritativeFields.eligibleFieldIds,
    fieldValues: input.authoritativeFields.fieldValues,
    messageTemplate: input.authoritativeFields.messageTemplate,
  });

  const renderedMessage = await formatIntegrationDeliveryMessage({
    workspaceType: input.workspaceType,
    eventType: input.eventType,
    payload: shadowPayload,
  });
  const authoritativeRendered = await formatIntegrationDeliveryMessage({
    workspaceType: input.workspaceType,
    eventType: input.eventType,
    payload: authoritativePayload,
  });

  const mismatches: string[] = [];
  if (renderedMessage !== authoritativeRendered) {
    mismatches.push("rendered_message");
  }

  return {
    renderedMessage,
    renderedParity: {
      matches: mismatches.length === 0,
      mismatches,
    },
  };
}
