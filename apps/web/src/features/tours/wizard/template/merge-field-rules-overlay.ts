import type { TourFormProfile } from "@repo/types";

import { getProfileRules } from "@/features/tours/wizard/profileRules/getProfileRules";
import type {
  FieldRequiredness,
  FieldRule,
  FieldVisibility,
  ProfileRules,
  WizardFieldPath,
} from "@/features/tours/wizard/profileRules/types";

export type FieldRuleOverlayPatch = {
  readonly visibility?: FieldVisibility;
  readonly required?: FieldRequiredness;
};

const REQUIREDNESS: ReadonlySet<string> = new Set([
  "required",
  "recommended",
  "optional",
  "forbidden",
]);

const VISIBILITY: ReadonlySet<string> = new Set(["always", "active", "hidden"]);

export function parseFieldRulesOverlay(
  raw: Readonly<Record<string, unknown>> | undefined,
): ReadonlyMap<WizardFieldPath, FieldRuleOverlayPatch> {
  const out = new Map<WizardFieldPath, FieldRuleOverlayPatch>();
  if (!raw) {
    return out;
  }
  for (const [path, value] of Object.entries(raw)) {
    if (!path.trim() || !value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const o = value as Record<string, unknown>;
    const visibility =
      typeof o.visibility === "string" && VISIBILITY.has(o.visibility)
        ? (o.visibility as FieldVisibility)
        : undefined;
    const required =
      typeof o.required === "string" && REQUIREDNESS.has(o.required)
        ? (o.required as FieldRequiredness)
        : undefined;
    if (visibility === undefined && required === undefined) {
      continue;
    }
    out.set(path as WizardFieldPath, {
      ...(visibility !== undefined ? { visibility } : {}),
      ...(required !== undefined ? { required } : {}),
    });
  }
  return out;
}

export function mergeProfileRulesWithFieldOverlay(
  base: ProfileRules,
  overlay: ReadonlyMap<WizardFieldPath, FieldRuleOverlayPatch>,
): ProfileRules {
  if (overlay.size === 0) {
    return base;
  }
  const fields = new Map(base.fields);
  for (const [path, patch] of overlay) {
    const rule = fields.get(path);
    if (!rule) {
      continue;
    }
    const next: FieldRule = {
      ...rule,
      ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
      ...(patch.required !== undefined ? { required: patch.required } : {}),
    };
    fields.set(path, next);
  }
  return { ...base, fields };
}

export function getProfileRulesForWizard(
  profile: TourFormProfile,
  fieldRulesOverlay?: Readonly<Record<string, unknown>>,
): ProfileRules {
  const base = getProfileRules(profile);
  const overlay = parseFieldRulesOverlay(fieldRulesOverlay);
  return mergeProfileRulesWithFieldOverlay(base, overlay);
}
