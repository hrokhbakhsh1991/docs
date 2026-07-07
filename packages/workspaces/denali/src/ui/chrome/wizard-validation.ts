import type { RenderStepPlan, ValidationResult } from "@app-tour/platform-core";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import type { DenaliWizardRulesModule } from "../../wizard/denali-wizard-rules-module";
import type { DenaliWizardRuleEvalContext } from "../../wizard/denali-wizard-submit-payload";
import {
  buildFieldStepResolver,
  buildFieldStepResolverFromTemplate,
} from "../../wizard/build-field-step-resolver";

export type DenaliWizardValidationScope = {
  readonly stepId?: string;
  readonly visibleSteps?: readonly RenderStepPlan[];
};

export function validateDenaliWizardDraftSync(
  plugin: WorkspacePlugin,
  draft: DenaliTourWizardDraft,
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
  draft: DenaliTourWizardDraft,
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
  draft: DenaliTourWizardDraft,
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

export { buildFieldStepResolver, buildFieldStepResolverFromTemplate };
