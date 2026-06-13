import {
  PlatformWizardEngine,
  type RenderFieldPlan,
  type RenderStepPlan,
  type ValidationResult,
} from "@app-tour/platform-core";
import { createCanonicalDocument, type WorkspacePlugin, type WorkspaceWizardHostPluginContext } from "@app-tour/workspace-sdk";

import { projectDenaliWizardFormToCanonicalIngressData } from "../acl/migrateDenaliCanonical";
import { collectDenaliPublishReadinessRuleIssues } from "../validation/publishReadinessRules";
import { mapFormPathToCanonical } from "../rules/denaliCanonicalPaths";
import type { DenaliUIContextOptions } from "../rules/denaliContextualRules";
import {
  getCanonicalStringFromDraft,
  getCanonicalValueFromDraft,
  type CanonicalWizardDraftEnvelope,
} from "./canonical-draft-access";
import { resolveDenaliCompositeRendererId } from "../composites/denali-composite-registry";
import { DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR } from "../composites/denali-composite-anchors";
import type { DenaliFieldDefinition } from "../field-registry/denaliFieldRegistryData";
import { DENALI_FIELD_DEFINITIONS } from "../field-registry/denaliFieldRegistryData";
import { resolveDenaliDimensionsFromDraft } from "./apply-contextual-render-plan";
import type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";
import { tourWizardDraftToDenaliForm } from "./denali-wizard-form-adapter";
import type { DenaliWizardRuleEvalContext } from "./denali-wizard-rule-eval-context";
import { sanitizeDenaliWizardDraftRecord } from "./denali-wizard-draft-sanitize";

const DENALI_COMPOSITE_FIELD_BY_CANONICAL_PATH = new Map<string, DenaliFieldDefinition>(
  DENALI_FIELD_DEFINITIONS.flatMap((field) => {
    const compositeId = resolveDenaliCompositeRendererId(field);
    if (compositeId == null) {
      return [];
    }
    return [
      [field.canonicalPath, field] as const,
      [compositeId, field] as const,
    ];
  })
);

/** Composite widgets that persist string[] at the canonical path (not platform composite objects). */
const DENALI_STRING_ARRAY_CANONICAL_PATHS = new Set([
  "leaderUserIds",
  "program.themeIds",
  "program.guideLanguageIds",
]);

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

function isEmptyHiddenShellValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (typeof value === "string" && value.trim() === "") {
    return true;
  }
  return (
    typeof value === "object" &&
    value != null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

function resolveDenaliCompositeCanonicalPath(fieldId: string): string {
  const field = DENALI_COMPOSITE_FIELD_BY_CANONICAL_PATH.get(fieldId);
  return field?.canonicalPath ?? fieldId;
}

function isDenaliHiddenShellPoison(
  violation: ValidationResult["violations"][number],
  envelope: CanonicalWizardDraftEnvelope
): boolean {
  if (violation.code !== "HIDDEN_FIELD_POISON" || violation.fieldId == null) {
    return false;
  }
  const canonicalPath = resolveDenaliCompositeCanonicalPath(violation.fieldId);
  const value = getCanonicalValueFromDraft(envelope, canonicalPath);
  return isEmptyHiddenShellValue(value);
}

function isDenaliCompositeStorageMismatch(
  violation: ValidationResult["violations"][number],
  envelope: CanonicalWizardDraftEnvelope
): boolean {
  if (violation.code !== "CANONICAL_TYPE_MISMATCH" || violation.fieldId == null) {
    return false;
  }
  if (DENALI_STRING_ARRAY_CANONICAL_PATHS.has(violation.fieldId)) {
    const value = getCanonicalValueFromDraft(envelope, violation.fieldId);
    return value === undefined || Array.isArray(value);
  }
  const field = DENALI_COMPOSITE_FIELD_BY_CANONICAL_PATH.get(violation.fieldId);
  if (field == null) {
    return false;
  }
  const value = getCanonicalValueFromDraft(envelope, field.canonicalPath);
  if (Array.isArray(value)) {
    return true;
  }
  if (typeof value === "object" && value !== null) {
    return true;
  }
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value == null
  );
}

function filterDenaliCompositeStorageViolations(
  result: ValidationResult,
  envelope: CanonicalWizardDraftEnvelope
): ValidationResult {
  if (result.ok) {
    return result;
  }
  const violations = result.violations.filter(
    (violation) =>
      !isDenaliCompositeStorageMismatch(violation, envelope) &&
      !isDenaliHiddenShellPoison(violation, envelope)
  );
  return {
    ok: violations.length === 0,
    violations,
  };
}

/** API + wizard — denali composite/array storage and hidden-shell poison parity filter. */
export function filterDenaliCanonicalValidationResult(
  result: ValidationResult,
  data: Readonly<Record<string, unknown>>
): ValidationResult {
  return filterDenaliCompositeStorageViolations(result, { data });
}

function expandStepFieldsForCompositeDependents(step: RenderStepPlan): RenderStepPlan {
  const extraPaths = new Set<string>();
  for (const field of step.fields) {
    const dependents = DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR[field.canonicalPath];
    if (dependents == null) {
      continue;
    }
    for (const path of dependents) {
      extraPaths.add(path);
    }
  }
  if (extraPaths.size === 0) {
    return step;
  }
  const existing = new Set(step.fields.map((field) => field.canonicalPath));
  const synthetic = [...extraPaths]
    .filter((path) => !existing.has(path))
    .map(
      (path): RenderFieldPlan => ({
        fieldId: path,
        canonicalPath: path,
        kind: "text",
        required: false,
        hidden: false,
        stepId: step.stepId,
      })
    );
  return {
    ...step,
    fields: [...step.fields, ...synthetic],
  };
}

function filterValidationToStep(
  result: ValidationResult,
  step: RenderStepPlan
): ValidationResult {
  const expandedStep = expandStepFieldsForCompositeDependents(step);
  if (result.ok) {
    return result;
  }
  const fieldIds = new Set(expandedStep.fields.map((field) => field.fieldId));
  const canonicalPaths = new Set(expandedStep.fields.map((field) => field.canonicalPath));
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
  scope?: DenaliWizardValidationScope,
  evalContext?: DenaliWizardRuleEvalContext
): ValidationResult {
  const draftForValidation =
    plugin.id === "denali" && denaliRules != null && evalContext != null
      ? sanitizeDenaliWizardDraftRecord(draft, denaliRules, evalContext)
      : draft;
  const envelope = asDraftEnvelope(draftForValidation);
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

  let result = engine.validateCanonical(document, {
    tenantId,
    dimensions,
  });
  result = filterDenaliCompositeStorageViolations(result, { data: document.data });

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
  readonly plugin: WorkspaceWizardHostPluginContext;
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly tenantId: string;
  readonly evalContext?: unknown;
  readonly scope?: {
    readonly stepId?: string;
    readonly visibleSteps?: readonly unknown[];
  };
}): ValidationResult {
  const plugin = input.plugin as WorkspacePlugin;
  return validateDenaliWizardDraftSync(
    plugin,
    input.draft,
    input.rulesModule as DenaliWizardRulesModule | null,
    input.tenantId,
    input.scope as DenaliWizardValidationScope | undefined,
    input.evalContext as DenaliWizardRuleEvalContext | undefined
  );
}

export { getCanonicalStringFromDraft };
