import type { RuleConfig } from "@repo/shared";
import { DENALI_WORKSPACE } from "@repo/shared-contracts";
import {
  applyOverlayToRuleSet,
  denaliRuleSet,
  parseFieldRulesOverlay,
  type DenaliRuleSet,
  type FieldRuleOverlayPatch,
} from "@repo/denali-domain";
import { normalizeTourFormProfileInput, type TourFormProfile } from "@repo/types";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { DENALI_FORM_RULE_CONFIG } from "../../../../lib/form-rule-engine/denaliFormRuleConfig";
import type {
  TenantWizardStepOverrides,
  TenantWizardTemplate,
} from "@/features/tours/wizard/template/tenant-wizard-template.types";

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
