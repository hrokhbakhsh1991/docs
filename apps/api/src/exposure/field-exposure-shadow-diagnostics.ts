import type { CanonicalDeliveryPayload } from "../integrations/application/enrich-canonical-delivery-payload";
import type { ResolvedDeliveryFieldPolicy } from "../integrations/application/delivery-field-definitions";

import type { ExposureIntent } from "./exposure-intent";
import {
  resolveShadowExposureFromDelivery,
  type ShadowExposureDecision,
} from "./shadow-exposure-resolver";
import type { AuthoritativeDeliveryFields } from "./shadow-delivery-field-parity";

export const FIELD_EXPOSURE_SHADOW_DIAGNOSTICS_ENV =
  "FIELD_EXPOSURE_SHADOW_DIAGNOSTICS" as const;

export function isFieldExposureShadowDiagnosticsEnabled(
  value: string | null | undefined = process.env[FIELD_EXPOSURE_SHADOW_DIAGNOSTICS_ENV],
): boolean {
  return value?.trim().toLowerCase() === "true";
}

export type ResolveFieldExposureShadowDiagnosticsInput = {
  readonly workspaceType: string | null;
  readonly surface: string;
  readonly eventType: string;
  readonly connectionId: string;
  readonly basePayload: Record<string, unknown>;
  readonly deliveryPolicy: ResolvedDeliveryFieldPolicy | null;
  readonly enriched: CanonicalDeliveryPayload | null;
  readonly exposureIntent: ExposureIntent | null;
  readonly messageTemplate: string | null;
  readonly authoritativeDeliveryFields: AuthoritativeDeliveryFields;
};

/**
 * Phase 8e — optional shadow parity metadata for local diagnostics only.
 */
export function resolveFieldExposureShadowDiagnostics(
  input: ResolveFieldExposureShadowDiagnosticsInput,
): ShadowExposureDecision | null {
  if (!isFieldExposureShadowDiagnosticsEnabled()) {
    return null;
  }

  return resolveShadowExposureFromDelivery({
    context: {
      workspaceType: input.workspaceType,
      surface: input.surface,
      audience: "external_channel",
      trigger: input.eventType,
      scope: {
        connectionId: input.connectionId,
      },
    },
    eventType: input.eventType,
    basePayload: input.basePayload,
    deliveryPolicy: input.deliveryPolicy,
    enriched: input.enriched,
    exposureIntent: input.exposureIntent,
    templateOverrideId: input.messageTemplate,
    authoritativeDeliveryFields: input.authoritativeDeliveryFields,
  });
}
