export const LEGACY_INTEGRATION_DELIVERY_INTENT_ADAPTER_SOURCE =
  "integration_delivery_intent_adapter" as const;
export const NATIVE_EXPOSURE_INTENT_SOURCE = "native" as const;

export type ExposureIntentMode = "inherit_profile" | "override_fields" | "disabled";

export type ExposureFieldDecoration = {
  readonly prefix: string;
};

export type ExposureFieldDecorations = Readonly<Record<string, ExposureFieldDecoration>>;

export type ExposureIntentScope = {
  readonly connectionId?: string;
  readonly eventType?: string;
  readonly [key: string]: unknown;
};

/**
 * Transitional API-side view of the target ExposureIntent domain.
 *
 * Phase 2 intentionally keeps this as a read-path model over existing persistence.
 * It must not own provider credentials or replace runtime dispatch until the shadow
 * resolver proves output compatibility.
 */
export type ExposureIntent = {
  readonly id?: string;
  readonly profileId?: string;
  readonly workspaceType: string;
  readonly entityType?: string;
  readonly surface?: string;
  readonly audience?: string;
  readonly trigger?: string;
  readonly scope: ExposureIntentScope;
  readonly mode: ExposureIntentMode;
  readonly selectedFieldIds: readonly string[];
  readonly fieldDecorations?: ExposureFieldDecorations;
  readonly templateOverrideId?: string;
  readonly source:
    | typeof LEGACY_INTEGRATION_DELIVERY_INTENT_ADAPTER_SOURCE
    | typeof NATIVE_EXPOSURE_INTENT_SOURCE;
  readonly sourceId: string;
  readonly version: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};
