import type { CanonicalDeliveryPayload } from "../integrations/application/enrich-canonical-delivery-payload";
import type { ResolvedDeliveryFieldPolicy } from "../integrations/application/delivery-field-definitions";

import type { ExposureIntent } from "./exposure-intent";
import {
  resolveShadowDeliveryFieldParity,
  type AuthoritativeDeliveryFields,
  type ShadowDeliveryParity,
} from "./shadow-delivery-field-parity";
import { resolveShadowExposureParity, type ShadowExposureParity } from "./shadow-exposure-parity";
import {
  resolveShadowRenderedDeliveryParity,
  type ShadowRenderedParity,
} from "./shadow-rendered-delivery-parity";

export const LEGACY_DELIVERY_SHADOW_EXPOSURE_RESOLVER =
  "legacy_delivery_shadow_exposure_resolver" as const;

export type ShadowExposureContext = {
  readonly workspaceType: string | null;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly scope?: {
    readonly connectionId?: string;
  };
};

export type ShadowExposureDecision = {
  readonly resolver: typeof LEGACY_DELIVERY_SHADOW_EXPOSURE_RESOLVER;
  readonly context: ShadowExposureContext;
  readonly sourceIntent: ExposureIntent | null;
  readonly candidateFieldIds: readonly string[];
  readonly exposedFieldIds: readonly string[];
  readonly fieldValues: Readonly<Record<string, string>>;
  readonly templateOverrideId?: string;
  readonly deliveryParity: ShadowDeliveryParity;
  readonly renderedMessage: string;
  readonly renderedParity: ShadowRenderedParity;
  readonly parity: ShadowExposureParity;
};

export type ResolveShadowExposureFromDeliveryInput = {
  readonly context: ShadowExposureContext;
  readonly eventType: string;
  readonly basePayload: Record<string, unknown>;
  readonly deliveryPolicy: ResolvedDeliveryFieldPolicy | null;
  readonly enriched: CanonicalDeliveryPayload | null;
  readonly exposureIntent: ExposureIntent | null | undefined;
  readonly templateOverrideId: string | null;
  readonly authoritativeDeliveryFields: AuthoritativeDeliveryFields;
};

/**
 * Phase 3 shadow resolver.
 *
 * Mirrors the current integration delivery result into Exposure-shaped metadata.
 * It does not call providers, schedule jobs, or change authoritative delivery fields.
 */
export async function resolveShadowExposureFromDelivery(
  input: ResolveShadowExposureFromDeliveryInput,
): Promise<ShadowExposureDecision | null> {
  if (input.deliveryPolicy === null) {
    return null;
  }

  const fieldValues = input.enriched?.fieldValues ?? {};
  const shadowFields = {
    candidateFieldIds: input.deliveryPolicy.candidateFieldIds,
    eligibleFieldIds: input.deliveryPolicy.eligibleFieldIds,
    fieldValues,
    messageTemplate: input.templateOverrideId,
  };
  const { renderedMessage, renderedParity } = await resolveShadowRenderedDeliveryParity({
    workspaceType: input.context.workspaceType,
    eventType: input.eventType,
    basePayload: input.basePayload,
    shadowFields,
    authoritativeFields: input.authoritativeDeliveryFields,
  });
  const deliveryParity = resolveShadowDeliveryFieldParity({
    shadow: {
      candidateFieldIds: shadowFields.candidateFieldIds,
      exposedFieldIds: shadowFields.eligibleFieldIds,
      fieldValues: shadowFields.fieldValues,
      ...(input.templateOverrideId === null
        ? {}
        : { templateOverrideId: input.templateOverrideId }),
    },
    authoritative: input.authoritativeDeliveryFields,
  });
  const parity = resolveShadowExposureParity({
    deliveryParity,
    renderedParity,
  });

  return {
    resolver: LEGACY_DELIVERY_SHADOW_EXPOSURE_RESOLVER,
    context: input.context,
    sourceIntent: input.exposureIntent ?? null,
    candidateFieldIds: shadowFields.candidateFieldIds,
    exposedFieldIds: shadowFields.eligibleFieldIds,
    fieldValues,
    ...(input.templateOverrideId === null ? {} : { templateOverrideId: input.templateOverrideId }),
    deliveryParity,
    renderedMessage,
    renderedParity,
    parity,
  };
}
