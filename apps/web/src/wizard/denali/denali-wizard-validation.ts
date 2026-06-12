import type { RenderStepPlan, ValidationResult } from "@app-tour/platform-core";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

import type { DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";

import type { DenaliWizardRuleEvalContext } from "./denali-wizard-ui-context";

export type DenaliWizardValidationScope = {
  readonly stepId?: string;
  readonly visibleSteps?: readonly RenderStepPlan[];
};

export function validateDenaliWizardDraftSync(
  plugin: WorkspacePlugin,
  draft: TourWizardDraft,
  denaliRules: DenaliWizardRulesModule | null,
  tenantId: string,
  scope?: DenaliWizardValidationScope
): ValidationResult {
  const validate = plugin.wizardHost?.validateDraftSync;
  if (validate == null) {
    return { ok: true, violations: [] };
  }
  return validate({
    plugin,
    draft: draft as unknown as Record<string, unknown>,
    rulesModule: denaliRules,
    tenantId,
    scope: scope as DenaliWizardValidationScope | undefined,
  }) as ValidationResult;
}

export function validateDenaliPublishReadinessSync(
  plugin: WorkspacePlugin,
  draft: TourWizardDraft,
  denaliRules: DenaliWizardRulesModule | null,
  evalContext: DenaliWizardRuleEvalContext,
  scope?: { readonly publishTransition?: boolean }
): ValidationResult {
  const validate = plugin.wizardHost?.validatePublishReadiness;
  if (validate == null) {
    return { ok: true, violations: [] };
  }
  return validate({
    plugin,
    draft: draft as unknown as Record<string, unknown>,
    rulesModule: denaliRules,
    evalContext,
    scope,
  }) as ValidationResult;
}

function mergeValidationResults(
  primary: ValidationResult,
  secondary: ValidationResult
): ValidationResult {
  if (primary.ok && secondary.ok) {
    return { ok: true, violations: [] };
  }
  return {
    ok: false,
    violations: [...primary.violations, ...secondary.violations],
  };
}

/** Canonical + rule-engine publish matrix (Phase 12.6). */
export function validateDenaliPublishTransitionSync(
  plugin: WorkspacePlugin,
  draft: TourWizardDraft,
  denaliRules: DenaliWizardRulesModule | null,
  tenantId: string,
  evalContext: DenaliWizardRuleEvalContext
): ValidationResult {
  const canonical = validateDenaliWizardDraftSync(plugin, draft, denaliRules, tenantId);
  const readiness = validateDenaliPublishReadinessSync(plugin, draft, denaliRules, evalContext, {
    publishTransition: true,
  });
  return mergeValidationResults(canonical, readiness);
}

export function buildFieldStepResolverFromTemplate(
  templateSteps: readonly { readonly stepId: string; readonly enabled?: boolean; readonly fields: readonly { readonly canonicalPath: string; readonly hidden?: boolean }[] }[]
): (fieldId: string) => string | undefined {
  const byCanonicalPath = new Map<string, string>();
  for (const step of templateSteps) {
    if (step.enabled === false) {
      continue;
    }
    for (const field of step.fields) {
      if (field.hidden === true) {
        continue;
      }
      byCanonicalPath.set(field.canonicalPath, step.stepId);
    }
  }
  return (fieldId: string) => byCanonicalPath.get(fieldId);
}

export function buildFieldStepResolver(
  visibleSteps: readonly RenderStepPlan[]
): (fieldId: string) => string | undefined {
  const byFieldId = new Map<string, string>();
  const byCanonicalPath = new Map<string, string>();
  for (const step of visibleSteps) {
    for (const field of step.fields) {
      byFieldId.set(field.fieldId, step.stepId);
      byCanonicalPath.set(field.canonicalPath, step.stepId);
    }
  }
  return (fieldId: string) => byFieldId.get(fieldId) ?? byCanonicalPath.get(fieldId);
}
