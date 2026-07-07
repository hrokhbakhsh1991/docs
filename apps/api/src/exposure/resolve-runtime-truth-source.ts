import { normalizeIntegrationEventType } from "@app-tour/platform-core";

/**
 * Unified control-plane migration Phase 1 — runtime truth visibility (observability only).
 *
 * These helpers label the selector the dispatch path already used and report the effective
 * exposure coordinate. They perform no field selection and must never change dispatch behavior.
 */

/** Which selector actually chose the delivered field ids for an emitted job. */
export type FieldExposureRuntimeTruthSource = "engine" | "engine_missing";

/** Effective audience used by the dispatch engine input today (mirrors hardcoded value). */
export const FIELD_EXPOSURE_RUNTIME_AUDIENCE = "external_channel" as const;

export type FieldExposureRuntimeCoordinate = {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
};

/**
 * Derives the authoritative selector for an emitted job from the
 * `engineSelectorMissing` flag computed by `resolveActiveDeliveryFieldIds`.
 *
 * Runtime mode is no longer a field-selection authority switch.
 */
export function resolveFieldExposureRuntimeTruthSource(input: {
  readonly engineSelectorMissing: boolean;
}): FieldExposureRuntimeTruthSource {
  return input.engineSelectorMissing ? "engine_missing" : "engine";
}

/**
 * Reports the exposure coordinate the dispatch path effectively uses today. It reuses the existing
 * trigger normalization instead of introducing a divergent derivation. Surface/audience/trigger are
 * runtime-derived, not intent-controlled, in Phase 1.
 */
export function resolveFieldExposureRuntimeCoordinate(input: {
  readonly surface: string;
  readonly eventType: string;
}): FieldExposureRuntimeCoordinate {
  const trigger = normalizeIntegrationEventType(input.eventType);
  const triggerName = trigger.kind === "event" ? trigger.name : trigger.kind;

  return {
    surface: input.surface,
    audience: FIELD_EXPOSURE_RUNTIME_AUDIENCE,
    trigger: triggerName,
  };
}
