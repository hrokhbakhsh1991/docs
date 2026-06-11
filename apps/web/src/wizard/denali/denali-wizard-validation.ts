import { PlatformWizardEngine, type RenderStepPlan, type ValidationResult } from "@app-tour/platform-core";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

import type { DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";
import { projectDenaliWizardFormToCanonicalIngressData } from "@app-tour/workspace-denali";

import { tourWizardDraftToDenaliForm } from "./denali-draft-form-adapter";
import { resolveDenaliDimensionsFromDraft } from "./denali-wizard-conditional-logic";
import { tourWizardDraftToCanonicalDocument } from "./denali-wizard-canonical";

export type DenaliWizardValidationScope = {
  readonly stepId?: string;
  readonly visibleSteps?: readonly RenderStepPlan[];
};

function pluginForWizardEngine(plugin: WorkspacePlugin): WorkspacePlugin {
  const {
    tourList: _tourList,
    tourClone: _tourClone,
    publicCatalog: _publicCatalog,
    ...wizardPlugin
  } = plugin;
  return wizardPlugin as WorkspacePlugin;
}

function filterValidationToStep(
  result: ValidationResult,
  step: RenderStepPlan
): ValidationResult {
  if (result.ok) {
    return result;
  }
  const fieldIds = new Set(step.fields.map((field) => field.fieldId));
  const canonicalPaths = new Set(step.fields.map((field) => field.canonicalPath));
  const violations = result.violations.filter(
    (violation) =>
      (violation.fieldId != null && fieldIds.has(violation.fieldId)) ||
      (violation.fieldId != null && canonicalPaths.has(violation.fieldId))
  );
  return {
    ok: violations.length === 0,
    violations,
  };
}

export function validateDenaliWizardDraftSync(
  plugin: WorkspacePlugin,
  draft: TourWizardDraft,
  denaliRules: DenaliWizardRulesModule | null,
  tenantId: string,
  scope?: DenaliWizardValidationScope
): ValidationResult {
  const engine = PlatformWizardEngine.create(pluginForWizardEngine(plugin));
  engine.init();
  const document =
    plugin.id === "denali" && denaliRules != null
      ? createCanonicalDocument({
          schemaVersion: 1,
          roots: [...plugin.wizard.roots],
          data: projectDenaliWizardFormToCanonicalIngressData(
            tourWizardDraftToDenaliForm(draft, denaliRules) as Record<string, unknown>
          ),
        })
      : tourWizardDraftToCanonicalDocument(draft, plugin.wizard.roots);
  const dimensions =
    plugin.id === "denali"
      ? resolveDenaliDimensionsFromDraft(draft, denaliRules ?? undefined)
      : { category: "mountain", duration: "single_day" };

  const result = engine.validateCanonical(document, {
    tenantId,
    dimensions,
  });

  if (scope?.stepId == null || scope.visibleSteps == null) {
    return result;
  }

  const step = scope.visibleSteps.find((entry) => entry.stepId === scope.stepId);
  if (step == null) {
    return result;
  }

  return filterValidationToStep(result, step);
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
