import {
  PlatformWizardEngine,
  stripWorkspacePluginForWizardEngine,
  type RenderFieldPlan,
  type RenderStepPlan,
  type ValidationResult,
} from "@app-tour/platform-core";
import { createCanonicalDocument, type WorkspacePlugin, type WorkspaceWizardHostPluginContext } from "@app-tour/workspace-sdk";
import { dedupeValidationViolations } from "@app-tour/wizard-navigation";

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
import { denaliFieldIdForCanonicalPath } from "../denali-plugin-adapter";
import type { DenaliFieldDefinition } from "../field-registry/denaliFieldRegistryData";
import { DENALI_FIELD_DEFINITIONS } from "../field-registry/denaliFieldRegistryData";
import {
  collectDenaliItineraryDayValidationIssues,
  parseDenaliItineraryDays,
} from "../schemas/denaliItineraryDaySchema";
import { getDenaliFieldDefinitionByCanonicalPath } from "../rules/denaliContextualRules";
import {
  applyDenaliConditionalFieldRules,
  hasDenaliWizardClassification,
  resolveDenaliDimensionsFromDraft,
  type DenaliWizardRuleEvalInput,
} from "./apply-contextual-render-plan";
import type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";
import { tourWizardDraftToDenaliForm } from "./denali-wizard-form-adapter";
import type { DenaliWizardRuleEvalContext } from "./denali-wizard-rule-eval-context";
import { isSocialMediaLinkWizardSatisfied } from "../ui/logic/denali-social-media-link-logic";
import { sanitizeDenaliWizardDraftRecord } from "./denali-wizard-draft-sanitize";
import {
  DENALI_TOUR_END_CANONICAL_PATH,
  DENALI_TOUR_START_CANONICAL_PATH,
  isDenaliMultiDayCalendarSpanTooShort,
  isDenaliTourEndDatetimeNotAfterStart,
  isDenaliTourStartDatetimeBeforeMin,
  isDenaliTourStartGrandfatheredPastBaseline,
} from "../ui/logic/denali-schedule-date-policy";
import {
  DENALI_WIZARD_NUMERIC_PAIRS,
  isDenaliNumericMinAfterMax,
  type DenaliWizardNumericPair,
} from "../ui/logic/denali-numeric-pair-policy";
import { isDenaliWizardFieldVisibleOnDraft } from "./denali-wizard-field-visibility";

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
  /**
   * ED-DT-01 — when editing an existing tour, unchanged past starts (same local
   * calendar day as this baseline ISO) are grandfathered; create/new past picks still fail.
   */
  readonly scheduleBaselineStartIso?: string;
};

function asDraftEnvelope(draft: Readonly<Record<string, unknown>>): CanonicalWizardDraftEnvelope {
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return { data: draft.data as Record<string, unknown> };
  }
  return { data: draft as Record<string, unknown> };
}

/** Strip callable host hooks before platform wizard engine bootstrap. */
function pluginForWizardEngine(plugin: WorkspacePlugin): WorkspacePlugin {
  return stripWorkspacePluginForWizardEngine(plugin);
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

type ExpandCompositeDependentsOptions = {
  readonly envelope?: CanonicalWizardDraftEnvelope;
  readonly rules?: DenaliWizardRulesModule | null;
  /** INV-DENALI-WIZ-012 — same overlay/uiOptions the host used for the visible plan. */
  readonly evalContext?: DenaliWizardRuleEvalContext;
};

function expandStepFieldsForCompositeDependents(
  step: RenderStepPlan,
  options?: ExpandCompositeDependentsOptions
): RenderStepPlan {
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
    .map((path): RenderFieldPlan => {
      const definition = getDenaliFieldDefinitionByCanonicalPath(path);
      return {
        fieldId: path,
        canonicalPath: path,
        kind: "text",
        // INV-DENALI-WIZ-005 — matrix/registry required must survive composite expand.
        required: definition?.ruleDefaults.required === true,
        hidden: definition?.ruleDefaults.hidden === true,
        stepId: step.stepId,
      };
    });
  const expanded: RenderStepPlan = {
    ...step,
    fields: [...step.fields, ...synthetic],
  };

  // INV-DENALI-WIZ-010 — re-apply contextual required/hidden (e.g. basePrice when paid).
  // INV-DENALI-WIZ-012 — forward evalContext so overlay/uiOptions match host plan eval.
  const rules = options?.rules;
  const envelope = options?.envelope;
  if (rules == null || envelope == null || !hasDenaliWizardClassification(envelope, rules)) {
    return expanded;
  }
  const [reapplied] = applyDenaliConditionalFieldRules(
    [expanded],
    envelope,
    rules,
    options?.evalContext as DenaliWizardRuleEvalInput | undefined
  );
  return reapplied ?? expanded;
}

function filterValidationToStep(
  result: ValidationResult,
  step: RenderStepPlan,
  expandOptions?: ExpandCompositeDependentsOptions
): ValidationResult {
  const expandedStep = expandStepFieldsForCompositeDependents(step, expandOptions);
  if (result.ok) {
    return result;
  }
  const fieldIds = new Set(expandedStep.fields.map((field) => field.fieldId));
  const canonicalPaths = new Set(expandedStep.fields.map((field) => field.canonicalPath));
  for (const path of canonicalPaths) {
    fieldIds.add(denaliFieldIdForCanonicalPath(path));
  }
  const violations = result.violations.filter(
    (violation) =>
      violation.fieldId != null &&
      (fieldIds.has(violation.fieldId) || canonicalPaths.has(violation.fieldId))
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
    return mergeDenaliNumericPairViolations(
      mergeDenaliScheduleDateViolations(result, envelope, undefined, scope),
      envelope,
      undefined
    );
  }

  const step = scope.visibleSteps.find((entry) => entry.stepId === scope.stepId);
  if (step == null) {
    return mergeDenaliNumericPairViolations(
      mergeDenaliScheduleDateViolations(result, envelope, undefined, scope),
      envelope,
      undefined
    );
  }

  const expandOptions: ExpandCompositeDependentsOptions = {
    envelope,
    rules: denaliRules,
    evalContext,
  };
  result = filterValidationToStep(result, step, expandOptions);
  result = mergeDenaliStepRequiredFieldViolations(result, envelope, step, expandOptions);
  return mergeDenaliNumericPairViolations(
    mergeDenaliScheduleDateViolations(result, envelope, step, scope),
    envelope,
    step
  );
}

function isDenaliDraftFieldValueEmpty(
  envelope: CanonicalWizardDraftEnvelope,
  field: RenderFieldPlan
): boolean {
  const value = getCanonicalValueFromDraft(envelope, field.canonicalPath);
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    if (field.canonicalPath === "socialMediaLink") {
      return !isSocialMediaLinkWizardSatisfied(value);
    }
    return value.trim().length === 0;
  }
  if (typeof value === "number") {
    return !Number.isFinite(value);
  }
  if (field.kind === "number") {
    return value === "";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return true;
    }
    // INV-DENALI-WIZ-009 — multi-day itinerary must have day/segment content, not just rows.
    if (field.canonicalPath === "program.itinerary") {
      const days = parseDenaliItineraryDays(value);
      if (days.length === 0) {
        return true;
      }
      return collectDenaliItineraryDayValidationIssues(days).length > 0;
    }
    return false;
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
}

/** Composite anchors store scalars at canonical path — enforce required after engine filter (MD-11). */
function mergeDenaliStepRequiredFieldViolations(
  result: ValidationResult,
  envelope: CanonicalWizardDraftEnvelope,
  step: RenderStepPlan,
  expandOptions?: ExpandCompositeDependentsOptions
): ValidationResult {
  const expandedStep = expandStepFieldsForCompositeDependents(step, {
    ...expandOptions,
    envelope: expandOptions?.envelope ?? envelope,
  });
  const extraViolations: Array<ValidationResult["violations"][number]> = [];

  for (const field of expandedStep.fields) {
    if (field.hidden || !field.required) {
      continue;
    }
    if (field.canonicalPath === "publishStatus" && step.stepId !== "review") {
      continue;
    }
    if (!isDenaliDraftFieldValueEmpty(envelope, field)) {
      continue;
    }
    extraViolations.push({
      code: "REQUIRED_FIELD_EMPTY",
      fieldId: denaliFieldIdForCanonicalPath(field.canonicalPath),
      message: `Required field empty at "${field.canonicalPath}"`,
    });
  }

  if (extraViolations.length === 0) {
    return result;
  }

  const merged = [...result.violations];
  for (const violation of extraViolations) {
    const duplicate = merged.some(
      (existing) =>
        existing.fieldId === violation.fieldId &&
        (existing.code === violation.code || existing.code === "UNKNOWN_CANONICAL_PATH")
    );
    if (!duplicate) {
      merged.push(violation);
    }
  }

  return {
    ok: false,
    violations: merged,
  };
}

function mergeDenaliScheduleDateViolations(
  result: ValidationResult,
  envelope: CanonicalWizardDraftEnvelope,
  step?: RenderStepPlan,
  scope?: DenaliWizardValidationScope
): ValidationResult {
  const expandedStep = step != null ? expandStepFieldsForCompositeDependents(step) : undefined;
  const startVisible =
    expandedStep == null ||
    expandedStep.fields.some(
      (field) => field.canonicalPath === DENALI_TOUR_START_CANONICAL_PATH && !field.hidden
    );
  const endVisible =
    expandedStep == null ||
    expandedStep.fields.some(
      (field) => field.canonicalPath === DENALI_TOUR_END_CANONICAL_PATH && !field.hidden
    );

  let next = result;
  if (startVisible) {
    next = mergeDenaliTourStartBeforeTodayViolation(next, envelope, scope);
  }
  if (endVisible) {
    next = mergeDenaliTourEndBeforeStartViolation(next, envelope);
    next = mergeDenaliTourMultiDayCalendarSpanViolation(next, envelope);
  }
  return next;
}

function isDenaliNumericPairVisible(
  envelope: CanonicalWizardDraftEnvelope,
  pair: DenaliWizardNumericPair,
  expandedStep?: RenderStepPlan
): boolean {
  if (expandedStep == null) {
    return (
      isDenaliWizardFieldVisibleOnDraft(envelope, pair.minPath, pair.visibilityStep) &&
      isDenaliWizardFieldVisibleOnDraft(envelope, pair.maxPath, pair.visibilityStep)
    );
  }
  const minField = expandedStep.fields.find((field) => field.canonicalPath === pair.minPath);
  const maxField = expandedStep.fields.find((field) => field.canonicalPath === pair.maxPath);
  return minField != null && !minField.hidden && maxField != null && !maxField.hidden;
}

function mergeDenaliNumericPairViolations(
  result: ValidationResult,
  envelope: CanonicalWizardDraftEnvelope,
  step?: RenderStepPlan
): ValidationResult {
  const expandedStep = step != null ? expandStepFieldsForCompositeDependents(step) : undefined;
  let next = result;
  for (const pair of DENALI_WIZARD_NUMERIC_PAIRS) {
    if (!isDenaliNumericPairVisible(envelope, pair, expandedStep)) {
      continue;
    }
    const minRaw = getCanonicalStringFromDraft(envelope, pair.minPath);
    const maxRaw = getCanonicalStringFromDraft(envelope, pair.maxPath);
    if (!isDenaliNumericMinAfterMax(minRaw, maxRaw)) {
      continue;
    }
    next = appendDenaliScheduleViolation(next, {
      code: pair.code,
      fieldId: denaliFieldIdForCanonicalPath(pair.minPath),
      message: `"${pair.minPath}" cannot be greater than "${pair.maxPath}"`,
    });
  }
  return next;
}

function appendDenaliScheduleViolation(
  result: ValidationResult,
  violation: { readonly code: string; readonly fieldId: string; readonly message: string }
): ValidationResult {
  const duplicate = result.violations.some(
    (existing) =>
      existing.fieldId === violation.fieldId &&
      (existing.code === violation.code || existing.code === "UNKNOWN_CANONICAL_PATH")
  );
  if (duplicate) {
    return result;
  }
  return {
    ok: false,
    violations: [...result.violations, violation],
  };
}

function mergeDenaliTourStartBeforeTodayViolation(
  result: ValidationResult,
  envelope: CanonicalWizardDraftEnvelope,
  scope?: DenaliWizardValidationScope
): ValidationResult {
  const startIso = getCanonicalStringFromDraft(envelope, DENALI_TOUR_START_CANONICAL_PATH);
  if (startIso.trim().length === 0 || !isDenaliTourStartDatetimeBeforeMin(startIso)) {
    return result;
  }

  if (isDenaliTourStartGrandfatheredPastBaseline(startIso, scope?.scheduleBaselineStartIso)) {
    return result;
  }

  return appendDenaliScheduleViolation(result, {
    code: "DENALI_TOUR_START_BEFORE_TODAY",
    fieldId: denaliFieldIdForCanonicalPath(DENALI_TOUR_START_CANONICAL_PATH),
    message: `Tour start cannot be before today at "${DENALI_TOUR_START_CANONICAL_PATH}"`,
  });
}

function mergeDenaliTourEndBeforeStartViolation(
  result: ValidationResult,
  envelope: CanonicalWizardDraftEnvelope
): ValidationResult {
  const startIso = getCanonicalStringFromDraft(envelope, DENALI_TOUR_START_CANONICAL_PATH);
  const endIso = getCanonicalStringFromDraft(envelope, DENALI_TOUR_END_CANONICAL_PATH);
  if (startIso.trim().length === 0 || endIso.trim().length === 0) {
    return result;
  }
  if (!isDenaliTourEndDatetimeNotAfterStart(startIso, endIso)) {
    return result;
  }

  return appendDenaliScheduleViolation(result, {
    code: "DENALI_TOUR_END_BEFORE_START",
    fieldId: denaliFieldIdForCanonicalPath(DENALI_TOUR_END_CANONICAL_PATH),
    message: `Tour end cannot be before or equal to start at "${DENALI_TOUR_END_CANONICAL_PATH}"`,
  });
}

function mergeDenaliTourMultiDayCalendarSpanViolation(
  result: ValidationResult,
  envelope: CanonicalWizardDraftEnvelope
): ValidationResult {
  const tourKind = getCanonicalStringFromDraft(envelope, "category");
  const startIso = getCanonicalStringFromDraft(envelope, DENALI_TOUR_START_CANONICAL_PATH);
  const endIso = getCanonicalStringFromDraft(envelope, DENALI_TOUR_END_CANONICAL_PATH);
  if (!isDenaliMultiDayCalendarSpanTooShort(tourKind, startIso, endIso)) {
    return result;
  }

  return appendDenaliScheduleViolation(result, {
    code: "DENALI_TOUR_MULTI_NEEDS_TWO_CALENDAR_DAYS",
    fieldId: denaliFieldIdForCanonicalPath(DENALI_TOUR_END_CANONICAL_PATH),
    message: `Multi-day tours need at least two distinct calendar days at "${DENALI_TOUR_END_CANONICAL_PATH}"`,
  });
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

export type DenaliCreateTourSubmitValidationResult =
  | { readonly kind: "rules-not-ready" }
  | { readonly kind: "ok"; readonly validation: ValidationResult };

/** Phase 15.2 P15-W-C1 — combined canonical + publish-readiness validation before create submit. */
export function validateDenaliCreateTourSubmitSync(input: {
  readonly plugin: WorkspacePlugin | WorkspaceWizardHostPluginContext;
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly tenantId: string;
  readonly evalContext?: unknown;
}): DenaliCreateTourSubmitValidationResult {
  const plugin = input.plugin as WorkspacePlugin;
  const rules = input.rulesModule as DenaliWizardRulesModule | null;
  if (rules == null) {
    return { kind: "rules-not-ready" };
  }

  const envelope = asDraftEnvelope(input.draft);
  const publishStatus = getCanonicalStringFromDraft(envelope, "publishStatus").trim().toLowerCase();
  const publishTransition = publishStatus === "active";
  if (publishTransition && input.evalContext == null) {
    return { kind: "rules-not-ready" };
  }

  const evalContext = input.evalContext as DenaliWizardRuleEvalContext | undefined;
  const canonical = validateDenaliWizardDraftSync(
    plugin,
    input.draft,
    rules,
    input.tenantId,
    undefined,
    evalContext
  );
  const readiness = validateDenaliPublishReadinessSync(input.draft, rules, evalContext, {
    publishTransition,
  });

  const violations = dedupeValidationViolations([
    ...canonical.violations,
    ...readiness.violations,
  ]);
  return {
    kind: "ok",
    validation: {
      ok: violations.length === 0,
      violations,
    },
  };
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
    readonly scheduleBaselineStartIso?: string;
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
