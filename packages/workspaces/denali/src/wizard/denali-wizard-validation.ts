import {
  PlatformWizardEngine,
  type RenderStepPlan,
  type ValidationResult,
} from "@app-tour/platform-core";
import { createCanonicalDocument, type WorkspacePlugin } from "@app-tour/workspace-sdk";

import { projectDenaliWizardFormToCanonicalIngressData } from "../acl/migrateDenaliCanonical";
import { collectDenaliPublishReadinessRuleIssues } from "../validation/publishReadinessRules";
import { mapFormPathToCanonical } from "../rules/denaliCanonicalPaths";
import type { DenaliUIContextOptions } from "../rules/denaliContextualRules";
import {
  getCanonicalStringFromDraft,
  type CanonicalWizardDraftEnvelope,
} from "./canonical-draft-access";
import { resolveDenaliDimensionsFromDraft } from "./apply-contextual-render-plan";
import type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";
import { tourWizardDraftToDenaliForm } from "./denali-wizard-form-adapter";
import type { DenaliWizardRuleEvalContext } from "./denali-wizard-rule-eval-context";

export type DenaliWizardValidationScope = {
  readonly stepId?: string;
  readonly visibleSteps?: readonly RenderStepPlan[];
};

function asDraftEnvelope(draft: Readonly<Record<string, unknown>>): CanonicalWizardDraftEnvelope {
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return { data: draft.data as Record<string, unknown> };
  }
  return { data: draft as Record<string, unknown> };
}

/** Strip callable host hooks before platform wizard engine bootstrap. */
function pluginForWizardEngine(plugin: WorkspacePlugin): WorkspacePlugin {
  const {
    tourList: _tourList,
    tourClone: _tourClone,
    publicCatalog: _publicCatalog,
    wizardHost: _wizardHost,
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

function tourWizardDraftToCanonicalDocument(
  draft: CanonicalWizardDraftEnvelope,
  roots: readonly string[]
): ReturnType<typeof createCanonicalDocument> {
  const OBJECT_ROOTS = new Set([
    "review",
    "program",
    "transport",
    "pricing",
    "participants",
    "policies",
    "tripDetails",
    "photos",
    "gatheringPoints",
  ]);

  const shell: Record<string, unknown> = {};
  for (const root of roots) {
    if (root.startsWith("denali_") || OBJECT_ROOTS.has(root)) {
      shell[root] = {};
      continue;
    }
    shell[root] = null;
  }

  const merged = structuredClone(shell);
  for (const [key, value] of Object.entries(draft.data)) {
    if (!(key in merged)) {
      continue;
    }
    if (Array.isArray(value)) {
      continue;
    }
    merged[key] = structuredClone(value);
  }

  return createCanonicalDocument({
    schemaVersion: 1,
    roots: [...roots],
    data: merged,
  });
}

export function validateDenaliWizardDraftSync(
  plugin: WorkspacePlugin,
  draft: Readonly<Record<string, unknown>>,
  denaliRules: DenaliWizardRulesModule | null,
  tenantId: string,
  scope?: DenaliWizardValidationScope
): ValidationResult {
  const envelope = asDraftEnvelope(draft);
  const engine = PlatformWizardEngine.create(pluginForWizardEngine(plugin));
  engine.init();
  const document =
    plugin.id === "denali" && denaliRules != null
      ? createCanonicalDocument({
          schemaVersion: 1,
          roots: [...plugin.wizard.roots],
          data: projectDenaliWizardFormToCanonicalIngressData(
            tourWizardDraftToDenaliForm(envelope, denaliRules) as unknown as Record<string, unknown>
          ),
        })
      : tourWizardDraftToCanonicalDocument(envelope, plugin.wizard.roots);
  const dimensions =
    plugin.id === "denali"
      ? resolveDenaliDimensionsFromDraft(envelope, denaliRules ?? undefined)
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

export type DenaliPublishReadinessValidationScope = {
  readonly publishTransition?: boolean;
};

function formPathToCanonicalFieldId(formPath: string | undefined): string | undefined {
  if (formPath == null || formPath.length === 0) {
    return undefined;
  }
  return mapFormPathToCanonical(formPath);
}

export function validateDenaliPublishReadinessSync(
  draft: Readonly<Record<string, unknown>>,
  denaliRules: DenaliWizardRulesModule | null,
  evalContext?: DenaliWizardRuleEvalContext,
  scope?: DenaliPublishReadinessValidationScope
): ValidationResult {
  if (denaliRules == null) {
    return { ok: true, violations: [] };
  }

  const envelope = asDraftEnvelope(draft);
  const form = tourWizardDraftToDenaliForm(envelope, denaliRules);
  const issues = collectDenaliPublishReadinessRuleIssues(form, evalContext?.ruleSet, {
    uiOptions: evalContext?.uiOptions as DenaliUIContextOptions | undefined,
    publishTransition: scope?.publishTransition === true,
  });

  if (issues.length === 0) {
    return { ok: true, violations: [] };
  }

  return {
    ok: false,
    violations: issues.map((issue) => ({
      code: issue.code,
      fieldId: formPathToCanonicalFieldId(issue.path),
      message: issue.message,
    })),
  };
}

export function validateDenaliPublishReadinessSyncFromHostInput(input: {
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly evalContext: unknown;
  readonly scope?: DenaliPublishReadinessValidationScope;
}): ValidationResult {
  return validateDenaliPublishReadinessSync(
    input.draft,
    input.rulesModule as DenaliWizardRulesModule | null,
    input.evalContext as DenaliWizardRuleEvalContext | undefined,
    input.scope
  );
}

export function validateDenaliWizardDraftSyncFromHostInput(input: {
  readonly plugin: WorkspacePlugin;
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly tenantId: string;
  readonly scope?: {
    readonly stepId?: string;
    readonly visibleSteps?: readonly unknown[];
  };
}): ValidationResult {
  return validateDenaliWizardDraftSync(
    input.plugin,
    input.draft,
    input.rulesModule as DenaliWizardRulesModule | null,
    input.tenantId,
    input.scope as DenaliWizardValidationScope | undefined
  );
}

export { getCanonicalStringFromDraft };
