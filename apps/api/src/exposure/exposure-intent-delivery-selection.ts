import type { ExposureIntent, ExposureFieldDecorations } from "./exposure-intent";

/**
 * Phase 7d compatibility helper.
 *
 * Native ExposureIntent can drive the current integration delivery field/template
 * selection during controlled cutover, but it must remain a pure value adapter.
 */
export function resolveExposureIntentCandidateFieldIds(
  intent: ExposureIntent | null | undefined,
): readonly string[] | null {
  if (intent == null || intent.mode === "inherit_profile") {
    return null;
  }
  if (intent.mode === "disabled") {
    return [];
  }
  return intent.selectedFieldIds;
}

export function resolveExposureIntentTemplateId(
  intent: ExposureIntent | null | undefined,
): string | null {
  if (intent == null || intent.templateOverrideId == null) {
    return null;
  }
  const trimmed = intent.templateOverrideId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveExposureIntentFieldDecorations(
  intent: ExposureIntent | null | undefined,
): ExposureFieldDecorations | null {
  if (intent == null || intent.fieldDecorations === undefined) {
    return null;
  }
  return Object.keys(intent.fieldDecorations).length > 0 ? intent.fieldDecorations : null;
}
