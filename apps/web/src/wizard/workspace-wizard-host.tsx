"use client";

import React from "react";
import { PlatformWizardEngine } from "@app-tour/platform-core";
import type { RenderStepPlan } from "@app-tour/platform-core";
import type { ScopedTenantAuthz, TenantAuthz, WorkspacePlugin } from "@app-tour/workspace-sdk";
import { mapValidationResultToIssues, type ValidationIssue } from "@app-tour/wizard-navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { resolveDenaliStepLabel } from "@/i18n/denali-wizard-labels";

import { loadDenaliWizardRulesModule, type DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";
import type { WizardTemplateStepRef } from "@/features/settings/wizard-template-types";
import {
  applyWizardTemplateToRenderPlan,
  filterRenderPlanByCanonicalPaths,
} from "@/tours/wizard-template-gate-logic";
import {
  shouldAttachSeedPrefillTestId,
  WIZARD_TEMPLATE_PREFILL_TEST_IDS,
} from "@/tours/wizard-template-prefill-logic";

import { canLoadWorkspaceWizard } from "./wizard-access";
import { WizardAccessDenied } from "./wizard-access-denied";
import { loadWorkspacePluginById } from "./load-workspace-plugin";
import {
  applyDenaliConditionalFieldRules,
  resolveDenaliDimensionsFromDraft,
} from "./denali/denali-wizard-conditional-logic";
import type { DenaliWizardRuleEvalContext } from "./denali/denali-wizard-ui-context";
import {
  buildWizardStepDescriptors,
  clampWizardStepIndex,
  resolveWizardStepLabel,
} from "./wizard-step-shell-logic";
import { WizardStepShell } from "./wizard-step-shell";

import { WizardField } from "./wizard-field";
import { DenaliWizardContentQualityHeader } from "./denali/denali-wizard-content-quality-header";
import { computeDenaliWizardCompletion } from "./denali/denali-wizard-completion";
import { DenaliPublishStatusField } from "./denali/denali-publish-status-field";
import { DenaliReviewStep } from "./denali/denali-review-step";
import { DenaliReviewValidationSummary } from "./denali/denali-review-validation-summary";
import {
  buildFieldStepResolver,
  validateDenaliWizardDraftSync,
} from "./denali/denali-wizard-validation";
import { useWizardStepValidation } from "./use-wizard-step-validation";

export type WorkspaceWizardHostProps = {
  readonly pluginId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly authz: TenantAuthz | ScopedTenantAuthz;
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  /** When set, only these canonical paths render (tenant wizard template overlay). */
  readonly allowedCanonicalPaths?: readonly string[];
  /** Ordered template steps — preferred over path-only filter (INV-WIZ-006). */
  readonly templateSteps?: readonly WizardTemplateStepRef[];
  readonly renderFooter?: (draft: TourWizardDraft) => ReactNode;
  /** Stable session for wizard-scoped MinIO uploads before tour id exists. */
  readonly wizardSessionId?: string;
  /** Controlled step index — when set, parent owns persisted step (11.5-T4). */
  readonly activeStepIndex?: number;
  readonly onActiveStepIndexChange?: (index: number) => void;
  /** Block step nav while draft sync runs (11.3-T5). */
  readonly navLocked?: boolean;
  /** Parent submit validation — host focuses first issue (11.7-T5). */
  readonly submitValidationIssues?: readonly ValidationIssue[] | null;
  readonly onSubmitValidationHandled?: () => void;
  /** Denali rule eval context — profile + template overlay (11.8-T3/T6). */
  readonly denaliRuleEvalContext?: DenaliWizardRuleEvalContext;
};

function resolveWizardDimensions(
  plugin: WorkspacePlugin,
  pluginId: string,
  draft: TourWizardDraft,
  denaliRules: DenaliWizardRulesModule | null,
  validationVariant: "default" | "basic" = "default"
): Record<string, string> {
  const matrix = plugin.ruleSet.matrixDimensions;
  if (matrix.includes("variant")) {
    return { variant: validationVariant };
  }
  if (pluginId === "denali" && matrix.includes("category") && matrix.includes("duration")) {
    return resolveDenaliDimensionsFromDraft(draft, denaliRules ?? undefined);
  }
  if (matrix.includes("category") && matrix.includes("duration")) {
    return { category: "mountain", duration: "single_day" };
  }
  const defaultCell = plugin.ruleSet.cells.find(
    (cell) => cell.cellId === plugin.ruleSet.defaultCellId
  );
  if (defaultCell) {
    return { ...defaultCell.dimensions };
  }
  return Object.fromEntries(matrix.map((key) => [key, validationVariant]));
}

/** Platform wizard ingress rejects callable operator/marketing surfaces — strip before engine bootstrap. */
function pluginForWizardEngine(plugin: WorkspacePlugin): WorkspacePlugin {
  const {
    tourList: _tourList,
    tourClone: _tourClone,
    publicCatalog: _publicCatalog,
    ...wizardPlugin
  } = plugin;
  return wizardPlugin as WorkspacePlugin;
}

/**
 * Workspace wizard host — CASL gate before plugin load; deny-by-default (no wizard DOM on 403).
 * Field binding follows {@link RenderFieldPlan} from the platform engine (canonicalPath, kind, hidden).
 * Denali: matrix cell follows tour kind; contextual rules filter fields on each draft change.
 */
export function WorkspaceWizardHost({
  pluginId,
  tenantId,
  workspaceId,
  authz,
  draft,
  onDraftChange,
  allowedCanonicalPaths,
  templateSteps,
  renderFooter,
  wizardSessionId,
  activeStepIndex: controlledStepIndex,
  onActiveStepIndexChange,
  navLocked = false,
  submitValidationIssues = null,
  onSubmitValidationHandled,
  denaliRuleEvalContext,
}: WorkspaceWizardHostProps) {
  const tWizard = useTranslations("wizard");
  const tDenali = useTranslations("denali");
  const resolveDefaultStepLabel = useCallback(
    (stepId: string) => resolveDenaliStepLabel(tDenali, stepId),
    [tDenali]
  );
  const access = useMemo(
    () => ({ authz, tenantId, pluginId, workspaceId }),
    [authz, tenantId, pluginId, workspaceId]
  );

  const authorized = useMemo(() => canLoadWorkspaceWizard(access), [access]);

  const [baseSteps, setBaseSteps] = useState<readonly RenderStepPlan[] | null>(null);
  const [workspacePlugin, setWorkspacePlugin] = useState<WorkspacePlugin | null>(null);
  const [denaliRules, setDenaliRules] = useState<DenaliWizardRulesModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewValidationIssues, setReviewValidationIssues] = useState<readonly ValidationIssue[]>(
    []
  );
  const [internalStepIndex, setInternalStepIndex] = useState(0);
  const activeStepIndex = controlledStepIndex ?? internalStepIndex;
  const setActiveStepIndex = onActiveStepIndexChange ?? setInternalStepIndex;

  const tourKind = getCanonicalStringValue(draft, "category");
  const dimensionsKey = useMemo(() => {
    if (pluginId !== "denali") {
      return "static";
    }
    const dims = resolveDenaliDimensionsFromDraft(draft, denaliRules ?? undefined);
    return `${dims.category}:${dims.duration}`;
  }, [pluginId, denaliRules, tourKind]);

  useEffect(() => {
    if (!authorized) {
      setBaseSteps(null);
      setDenaliRules(null);
      setError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (!canLoadWorkspaceWizard(access)) {
          return;
        }

        const rules =
          pluginId === "denali" ? await loadDenaliWizardRulesModule() : null;
        const plugin = await loadWorkspacePluginById(pluginId);
        const engine = PlatformWizardEngine.create(pluginForWizardEngine(plugin));
        engine.init();
        const plan = engine.buildRenderPlan({
          tenantId,
          dimensions: resolveWizardDimensions(plugin, pluginId, draft, rules),
        });

        if (!cancelled) {
          setDenaliRules(rules);
          setWorkspacePlugin(plugin);
          setBaseSteps(plan);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : "wizard_load_failed";
          setError(message);
          setBaseSteps(null);
          setWorkspacePlugin(null);
          setDenaliRules(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorized, access, pluginId, tenantId, dimensionsKey]);

  const visibleSteps = useMemo(() => {
    if (baseSteps == null) {
      return null;
    }

    let steps =
      templateSteps !== undefined && templateSteps.length > 0
        ? applyWizardTemplateToRenderPlan(baseSteps, templateSteps)
        : allowedCanonicalPaths !== undefined && allowedCanonicalPaths.length > 0
          ? filterRenderPlanByCanonicalPaths(baseSteps, allowedCanonicalPaths)
          : baseSteps;

    if (pluginId === "denali" && denaliRules != null) {
      steps = applyDenaliConditionalFieldRules(steps, draft, denaliRules, denaliRuleEvalContext);
    }

    return steps;
  }, [
    baseSteps,
    templateSteps,
    allowedCanonicalPaths,
    pluginId,
    denaliRules,
    draft,
    denaliRuleEvalContext,
  ]);

  const stepDescriptors = useMemo(
    () => (visibleSteps ?? []).map((step) => ({
      stepId: step.stepId,
      label: resolveWizardStepLabel(step.stepId, templateSteps, resolveDefaultStepLabel),
    })),
    [visibleSteps, templateSteps, resolveDefaultStepLabel]
  );

  const stepSignature = useMemo(
    () => stepDescriptors.map((step) => step.stepId).join("|"),
    [stepDescriptors]
  );

  useEffect(() => {
    const nextIndex = clampWizardStepIndex(activeStepIndex, stepDescriptors.length);
    if (nextIndex !== activeStepIndex) {
      setActiveStepIndex(nextIndex);
    }
  }, [stepSignature, stepDescriptors.length, activeStepIndex, setActiveStepIndex]);

  const resolveStepId = useMemo(
    () => (visibleSteps != null ? buildFieldStepResolver(visibleSteps) : () => undefined),
    [visibleSteps]
  );

  const goToStepById = useCallback(
    async (stepId: string) => {
      const index = stepDescriptors.findIndex((step) => step.stepId === stepId);
      if (index >= 0) {
        setActiveStepIndex(index);
      }
    },
    [stepDescriptors, setActiveStepIndex]
  );

  const { focusFirstFromResult, focusIssue } = useWizardStepValidation({
    goToStep: goToStepById,
  });

  const refreshReviewValidationIssues = useCallback(() => {
    if (workspacePlugin == null || pluginId !== "denali") {
      setReviewValidationIssues([]);
      return;
    }
    const result = validateDenaliWizardDraftSync(
      workspacePlugin,
      draft,
      denaliRules,
      tenantId
    );
    if (result.ok) {
      setReviewValidationIssues([]);
      return;
    }
    setReviewValidationIssues(
      mapValidationResultToIssues(result, { resolveStepId })
    );
  }, [workspacePlugin, pluginId, draft, denaliRules, tenantId, resolveStepId]);

  useEffect(() => {
    if (visibleSteps == null) {
      return;
    }
    const activeStep = visibleSteps[clampWizardStepIndex(activeStepIndex, visibleSteps.length)];
    if (activeStep?.stepId === "review") {
      refreshReviewValidationIssues();
    }
  }, [visibleSteps, activeStepIndex, refreshReviewValidationIssues]);

  useEffect(() => {
    if (submitValidationIssues == null || submitValidationIssues.length === 0) {
      return;
    }
    setReviewValidationIssues(submitValidationIssues);
    const first = submitValidationIssues[0];
    if (first != null) {
      void (async () => {
        if (first.stepId != null) {
          await goToStepById(first.stepId);
        }
        await focusIssue(first);
        onSubmitValidationHandled?.();
      })();
    }
  }, [submitValidationIssues, goToStepById, focusIssue, onSubmitValidationHandled]);

  const handleBeforeNext = useCallback(
    async (currentIndex: number) => {
      if (workspacePlugin == null || visibleSteps == null || pluginId !== "denali") {
        return true;
      }
      const step = visibleSteps[currentIndex];
      if (step == null || step.stepId === "review") {
        return true;
      }
      const result = validateDenaliWizardDraftSync(
        workspacePlugin,
        draft,
        denaliRules,
        tenantId,
        { stepId: step.stepId, visibleSteps }
      );
      if (result.ok) {
        return true;
      }
      await focusFirstFromResult(result, { resolveStepId });
      return false;
    },
    [
      workspacePlugin,
      visibleSteps,
      pluginId,
      draft,
      denaliRules,
      tenantId,
      focusFirstFromResult,
      resolveStepId,
    ]
  );

  const handleFocusValidationIssue = useCallback(
    (stepId: string, path: string) => {
      void (async () => {
        await goToStepById(stepId);
        await focusIssue({ path, message: "", stepId });
      })();
    },
    [goToStepById, focusIssue]
  );

  if (!authorized) {
    return <WizardAccessDenied />;
  }

  if (error) {
    return (
      <div role="alert" data-workspace-wizard-error>
        <p>{tWizard("host.loadError", { error })}</p>
      </div>
    );
  }

  if (!visibleSteps) {
    return <p data-workspace-wizard-loading>{tWizard("host.loading")}</p>;
  }

  if (visibleSteps.length === 0) {
    return (
      <p data-workspace-wizard-empty data-plugin-id={pluginId}>
        {tWizard("host.noFields")}
      </p>
    );
  }

  const activeStep = visibleSteps[clampWizardStepIndex(activeStepIndex, visibleSteps.length)];
  if (activeStep === undefined) {
    return (
      <p data-workspace-wizard-empty data-plugin-id={pluginId}>
        {tWizard("host.noFields")}
      </p>
    );
  }

  const activeLabel = resolveWizardStepLabel(
    activeStep.stepId,
    templateSteps,
    resolveDefaultStepLabel
  );

  const denaliCompletion =
    pluginId === "denali"
      ? computeDenaliWizardCompletion(draft, visibleSteps)
      : null;

  return (
    <div
      className="workspace-wizard"
      data-workspace-wizard
      data-plugin-id={pluginId}
      {...(pluginId === "denali" ? { "data-denali-wizard-host": true } : {})}
    >
      {denaliCompletion != null ? (
        <DenaliWizardContentQualityHeader completion={denaliCompletion} />
      ) : null}
      <WizardStepShell
        steps={buildWizardStepDescriptors(visibleSteps, templateSteps, resolveDefaultStepLabel)}
        activeIndex={activeStepIndex}
        onActiveIndexChange={setActiveStepIndex}
        lastStepFooter={renderFooter?.(draft)}
        navLocked={navLocked}
        onBeforeNext={handleBeforeNext}
      >
        <section
          key={activeStep.stepId}
          className="workspace-wizard__step"
          data-wizard-step={activeStep.stepId}
          aria-labelledby={`wizard-step-title-${activeStep.stepId}`}
        >
          <header className="workspace-wizard__step-header">
            <h2 id={`wizard-step-title-${activeStep.stepId}`} className="workspace-wizard__step-title">
              {activeLabel}
            </h2>
          </header>
          <div className="workspace-wizard__fields">
            {activeStep.stepId === "review" && pluginId === "denali" ? (
              <>
                <DenaliReviewStep draft={draft} />
                <DenaliReviewValidationSummary
                  issues={reviewValidationIssues}
                  steps={stepDescriptors}
                  onFocusIssue={handleFocusValidationIssue}
                />
                <DenaliPublishStatusField draft={draft} onDraftChange={onDraftChange} />
              </>
            ) : null}
            {activeStep.fields
              .filter(
                (field) =>
                  !(
                    activeStep.stepId === "review" &&
                    pluginId === "denali" &&
                    field.canonicalPath === "publishStatus"
                  )
              )
              .map((field) => {
                const path = field.canonicalPath;
                const value = getCanonicalStringValue(draft, path);

                return (
                  <div key={`${field.fieldId}:${path}`} className="workspace-wizard__field">
                    <WizardField
                      field={field}
                      value={value}
                      onChange={(next) => onDraftChange(setCanonicalStringValue(draft, path, next))}
                      draft={draft}
                      onDraftChange={onDraftChange}
                      pluginId={pluginId}
                      wizardSessionId={wizardSessionId}
                      workspaceFormProfile={denaliRuleEvalContext?.uiOptions.workspaceFormProfile}
                      dataTestId={
                        shouldAttachSeedPrefillTestId(path, pluginId)
                          ? WIZARD_TEMPLATE_PREFILL_TEST_IDS.seedPrefillField
                          : undefined
                      }
                    />
                  </div>
                );
              })}
          </div>
        </section>
      </WizardStepShell>
    </div>
  );
}
