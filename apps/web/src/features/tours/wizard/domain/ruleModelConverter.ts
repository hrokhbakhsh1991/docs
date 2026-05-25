import type { RuleConfig } from "@repo/shared";
import { DENALI_WORKSPACE } from "@repo/shared-contracts";
import { normalizeTourFormProfileInput, type TourFormProfile } from "@repo/types";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import {
  parseFieldRulesOverlay,
  type FieldRuleOverlayPatch,
} from "@/features/tours/wizard/template/merge-field-rules-overlay";
import type {
  TenantWizardStepOverrides,
  TenantWizardTemplate,
} from "@/features/tours/wizard/template/tenant-wizard-template.types";
import { mapDenaliCanonicalToFormPath } from "@/features/tours/wizard/denali/rules/denaliRuleRequired";
import type {
  DenaliRuleFieldDefinition,
  DenaliRuleModel,
  DenaliRuleSet,
} from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  denaliRuleSet,
} from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { DENALI_FORM_RULE_CONFIG } from "../../../../lib/form-rule-engine/denaliFormRuleConfig";

/** Minimal template fields needed to derive Denali rule models (full row or validator payload). */
export type WizardTemplateRuleSource =
  | TenantWizardTemplate
  | {
      readonly baseProfile?: TourFormProfile | "denali";
      readonly fieldRulesOverlay?: Readonly<Record<string, unknown>>;
      readonly stepOverrides?: TenantWizardStepOverrides;
    }
  | null;

function resolveTemplateBaseProfile(raw: unknown): TourFormProfile {
  if (raw === "denali") {
    return DENALI_WORKSPACE.profile;
  }
  return normalizeTourFormProfileInput(raw);
}

export type MappedTemplateRuleModel = {
  readonly profile: TourFormProfile;
  readonly ruleSet: DenaliRuleSet;
  readonly fieldOverlay: ReadonlyMap<string, FieldRuleOverlayPatch>;
  readonly stepOverrides: TenantWizardStepOverrides;
  /** Lookup/autocomplete rules for template-editing forms (FormRuleEngine). */
  readonly formRuleConfigs: readonly RuleConfig<DenaliCreateTourWizardForm>[];
};

function overlayPatchForPath(
  overlay: ReadonlyMap<string, FieldRuleOverlayPatch>,
  canonicalPath: string,
  formPath: string,
): FieldRuleOverlayPatch | undefined {
  return overlay.get(canonicalPath) ?? overlay.get(formPath);
}

function applyOverlayToField(
  field: DenaliRuleFieldDefinition,
  overlay: ReadonlyMap<string, FieldRuleOverlayPatch>,
): DenaliRuleFieldDefinition {
  const formPath = mapDenaliCanonicalToFormPath(field.path);
  const patch = overlayPatchForPath(overlay, field.path, formPath);
  if (patch == null) {
    return field;
  }

  let hidden = field.hidden;
  if (patch.visibility === "hidden") {
    hidden = true;
  } else if (patch.visibility === "always" || patch.visibility === "active") {
    hidden = false;
  }

  let required = field.required;
  if (patch.required === "required") {
    required = true;
  } else if (patch.required === "optional" || patch.required === "forbidden") {
    required = false;
  }

  return { ...field, hidden, required };
}

function cloneRuleModel(model: DenaliRuleModel): DenaliRuleModel {
  return {
    ...model,
    fields: model.fields.map((field) => ({ ...field })),
  };
}

function applyOverlayToRuleSet(
  base: DenaliRuleSet,
  overlay: ReadonlyMap<string, FieldRuleOverlayPatch>,
): DenaliRuleSet {
  const next = {} as DenaliRuleSet;

  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    next[category] = {} as DenaliRuleSet[typeof category];
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const model = base[category][duration];
      if (model == null) {
        next[category][duration] = null;
        continue;
      }
      const cloned = cloneRuleModel(model);
      next[category][duration] = {
        ...cloned,
        fields: cloned.fields.map((field) => applyOverlayToField(field, overlay)),
      };
    }
  }

  return next;
}

function overlayToVisibleFlag(patch: FieldRuleOverlayPatch): boolean | undefined {
  if (patch.visibility === "hidden") return false;
  if (patch.visibility === "always" || patch.visibility === "active") return true;
  return undefined;
}

function overlayToRequiredFlag(patch: FieldRuleOverlayPatch): boolean | undefined {
  if (patch.required === "required") return true;
  if (patch.required === "optional" || patch.required === "forbidden") return false;
  return undefined;
}

function mergeFormRuleWithOverlay(
  base: RuleConfig<DenaliCreateTourWizardForm>,
  overlay: ReadonlyMap<string, FieldRuleOverlayPatch>,
): RuleConfig<DenaliCreateTourWizardForm> {
  const patch = overlay.get(base.path);
  if (patch == null) {
    return base;
  }
  const visible = overlayToVisibleFlag(patch);
  const required = overlayToRequiredFlag(patch);
  return {
    ...base,
    ...(visible !== undefined ? { visible } : {}),
    ...(required !== undefined ? { required } : {}),
  };
}

function buildFormRuleConfigs(
  overlay: ReadonlyMap<string, FieldRuleOverlayPatch>,
): readonly RuleConfig<DenaliCreateTourWizardForm>[] {
  const basePaths = new Set(DENALI_FORM_RULE_CONFIG.map((rule) => rule.path));
  const merged = DENALI_FORM_RULE_CONFIG.map((rule) => mergeFormRuleWithOverlay(rule, overlay));
  const extra: RuleConfig<DenaliCreateTourWizardForm>[] = [];

  for (const [path, patch] of overlay) {
    if (basePaths.has(path)) {
      continue;
    }
    const visible = overlayToVisibleFlag(patch);
    const required = overlayToRequiredFlag(patch);
    if (visible === undefined && required === undefined) {
      continue;
    }
    extra.push({
      path,
      ...(visible !== undefined ? { visible } : {}),
      ...(required !== undefined ? { required } : {}),
    });
  }

  return [...merged, ...extra];
}

/**
 * Maps a persisted workspace template into the Denali {@link DenaliRuleSet} (and related metadata)
 * so template-editing flows can reuse the same wizard steps and rule-engine helpers.
 */
export function mapTemplateToRuleModel(
  template: WizardTemplateRuleSource,
): MappedTemplateRuleModel {
  const profile = resolveTemplateBaseProfile(
    template?.baseProfile ?? DENALI_WORKSPACE.profile,
  );
  const fieldOverlay = parseFieldRulesOverlay(template?.fieldRulesOverlay);
  const stepOverrides = template?.stepOverrides ?? { skip: [], insert: [] };

  return {
    profile,
    ruleSet: applyOverlayToRuleSet(denaliRuleSet, fieldOverlay),
    fieldOverlay,
    stepOverrides,
    formRuleConfigs: buildFormRuleConfigs(fieldOverlay),
  };
}
