import type { WorkspaceFieldPolicyManifest, WorkspaceFieldPolicyRule } from "@app-tour/workspace-sdk";

import {
  DENALI_DELIVERABLE_FIELD_IDS,
  DENALI_PUBLIC_DETAILS_FIELD_IDS,
  DENALI_REMINDER_FEED_FIELD_IDS,
  DENALI_USER_DASHBOARD_FIELD_IDS,
} from "../exposure/denali-exposure-surfaces";

export { DENALI_DELIVERABLE_FIELD_IDS };

/**
 * Delivery-eligible fields that are **selectable** but not part of the default deliverable set.
 * They get a `delivery`-surface visible rule (so the exposure engine surfaces them when an
 * admin selects them) without being delivered by default. `denali.location-zones` is the
 * composite anchor that renders the trip location zones (start/summit/camp/end).
 */
export const DENALI_OPTIONAL_DELIVERY_FIELD_IDS = Object.freeze([
  "denali.location-zones",
] as const);

function surfaceVisibleRule(
  surface: WorkspaceFieldPolicyRule["surface"],
  fieldId: string,
): WorkspaceFieldPolicyRule {
  return Object.freeze({
    id: `denali.${surface}.${fieldId.replace(/\./g, "-")}`,
    fieldId,
    surface,
    state: "visible",
    condition: Object.freeze({ kind: "always" }),
    priority: 10,
    enabled: true,
  });
}

function rulesForSurface(
  surface: WorkspaceFieldPolicyRule["surface"],
  fieldIds: readonly string[],
): readonly WorkspaceFieldPolicyRule[] {
  return Object.freeze(fieldIds.map((fieldId) => surfaceVisibleRule(surface, fieldId)));
}

const REGISTERED_SURFACE_FIELD_IDS = Object.freeze([
  ...new Set([...DENALI_USER_DASHBOARD_FIELD_IDS, ...DENALI_REMINDER_FEED_FIELD_IDS]),
] as const);

export const denaliFieldPolicyManifest = Object.freeze({
  manifestVersion: 1,
  definitions: Object.freeze([]),
  rules: Object.freeze([
    ...rulesForSurface("delivery", [
      ...DENALI_DELIVERABLE_FIELD_IDS,
      ...DENALI_OPTIONAL_DELIVERY_FIELD_IDS,
    ]),
    ...rulesForSurface("public_website", DENALI_PUBLIC_DETAILS_FIELD_IDS),
    ...rulesForSurface("profile", REGISTERED_SURFACE_FIELD_IDS),
  ]),
}) satisfies WorkspaceFieldPolicyManifest;
