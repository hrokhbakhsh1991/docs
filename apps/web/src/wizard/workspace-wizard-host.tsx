"use client";

import React from "react";
import { PlatformWizardEngine } from "@app-tour/platform-core";
import type { RenderStepPlan } from "@app-tour/platform-core";
import type { ScopedTenantAuthz, TenantAuthz, WorkspacePlugin } from "@app-tour/workspace-sdk";
import { mapValidationResultToIssues, wizardFieldPathAttributes, type ValidationIssue } from "@app-tour/wizard-navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
import { formatWizardTemplateStepLabel } from "@/tours/wizard-template-catalog-logic";

import { canLoadWorkspaceWizard } from "./wizard-access";
import { WizardAccessDenied } from "./wizard-access-denied";
import { loadWorkspacePluginById } from "./load-workspace-plugin";
import {
  buildWizardStepDescriptors,
  clampWizardStepIndex,
  resolveWizardStepLabel,
} from "./wizard-step-shell-logic";
import { WizardStepShell } from "./wizard-step-shell";

import { WizardField } from "./wizard-field";
import { resolveWizardCompositeSurface } from "./wizard-composite-surface-registry";
import {
  buildWizardValidationSurfaceProps,
  resolveWizardReviewSurface,
  resolveWizardValidationSurface,
} from "./wizard-review-surface-registry";
import { buildFieldStepResolver } from "./wizard-field-step-resolver";
import { useWizardStepValidation } from "./use-wizard-step-validation";
import { useWorkspaceWizardTranslator } from "./use-workspace-wizard-translator";

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
  /** Opaque workspace rule eval context (profile + template overlay). */
  readonly wizardRuleEvalContext?: unknown;
};

function resolveWizardDimensions(
  plugin: WorkspacePlugin,
  draft: TourWizardDraft,
  rulesModule: unknown,
  validationVariant: "default" | "basic" = "default"
): Record<string, string> {
  const hooks = plugin.wizardHost;
  if (hooks?.resolveMatrixDimensionsFromDraft != null) {
    return { ...hooks.resolveMatrixDimensionsFromDraft(draft as unknown as Record<string, unknown>, rulesModule) };
  }

  const matrix = plugin.ruleSet.matrixDimensions;
  if (matrix.includes("variant")) {
    return { variant: validationVariant };
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

function readWorkspaceFormProfileFromEvalContext(ctx: unknown): string | undefined {
  if (ctx == null || typeof ctx !== "object") {
    return undefined;
  }
  const uiOptions = (ctx as { uiOptions?: { workspaceFormProfile?: unknown } }).uiOptions;
  const profile = uiOptions?.workspaceFormProfile;
  return typeof profile === "string" ? profile : undefined;
}

/** Platform wizard ingress rejects callable operator/marketing surfaces — strip before engine bootstrap. */
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

/**
 * Workspace wizard host — CASL gate before plugin load; deny-by-default (no wizard DOM on 403).
 * Field binding follows {@link RenderFieldPlan} from the platform engine (canonicalPath, kind, hidden).
 * Workspace wizard host — matrix dimensions and contextual rules come from plugin.wizardHost hooks.
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
  wizardRuleEvalContext,
}: WorkspaceWizardHostProps) {
  const tWizard = useTranslations("wizard");
  const access = useMemo(
    () => ({ authz, tenantId, pluginId, workspaceId }),
    [authz, tenantId, pluginId, workspaceId]
  );

  const authorized = useMemo(() => canLoadWorkspaceWizard(access), [access]);

  const [baseSteps, setBaseSteps] = useState<readonly RenderStepPlan[] | null>(null);
  const [workspacePlugin, setWorkspacePlugin] = useState<WorkspacePlugin | null>(null);
  const [rulesModule, setRulesModule] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewValidationIssues, setReviewValidationIssues] = useState<readonly ValidationIssue[]>(
    []
  );
  const [stepNavValidationIssues, setStepNavValidationIssues] = useState<
    readonly ValidationIssue[]
  >([]);
  const [internalStepIndex, setInternalStepIndex] = useState(0);
  const activeStepIndex = controlledStepIndex ?? internalStepIndex;
  const setActiveStepIndex = onActiveStepIndexChange ?? setInternalStepIndex;

  const wizardHost = workspacePlugin?.wizardHost;
  const reviewStepId = wizardHost?.reviewStepId;
  const translateWorkspaceMessage = useWorkspaceWizardTranslator(wizardHost?.wizardMessageNamespace);
  const labelSurface = useMemo(
    () => resolveWizardCompositeSurface(wizardHost?.fieldLabelSurfaceId),
    [wizardHost?.fieldLabelSurfaceId]
  );
  const resolveDefaultStepLabel = useCallback(
    (stepId: string) => {
      if (labelSurface?.resolveStepLabel != null) {
        return labelSurface.resolveStepLabel(translateWorkspaceMessage, stepId);
      }
      return formatWizardTemplateStepLabel(stepId);
    },
    [labelSurface, translateWorkspaceMessage]
  );
  const reviewSurface = useMemo(
    () => resolveWizardReviewSurface(wizardHost?.reviewSurfaceId),
    [wizardHost?.reviewSurfaceId]
  );
  const validationSurface = useMemo(
    () =>
      resolveWizardValidationSurface(
        wizardHost?.validationSurfaceId,
        wizardHost?.reviewSurfaceId
      ),
    [wizardHost?.validationSurfaceId, wizardHost?.reviewSurfaceId]
  );

  const dimensionsKey = useMemo(() => {
    if (wizardHost?.resolveMatrixDimensionsFromDraft != null) {
      const dims = wizardHost.resolveMatrixDimensionsFromDraft(
        draft as unknown as Record<string, unknown>,
        rulesModule
      );
      return Object.entries(dims)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value}`)
        .join("|");
    }
    return "static";
  }, [wizardHost, rulesModule, draft]);

  useEffect(() => {
    if (!authorized) {
      setBaseSteps(null);
      setRulesModule(null);
      setError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (!canLoadWorkspaceWizard(access)) {
          return;
        }

        const plugin = await loadWorkspacePluginById(pluginId);
        const hooks = plugin.wizardHost;
        const rules =
          hooks?.loadRulesModule != null ? await hooks.loadRulesModule() : null;
        const engine = PlatformWizardEngine.create(pluginForWizardEngine(plugin));
        engine.init();
        const plan = engine.buildRenderPlan({
          tenantId,
          dimensions: resolveWizardDimensions(plugin, draft, rules),
        });

        if (!cancelled) {
          setRulesModule(rules);
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
          setRulesModule(null);
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

    if (wizardHost?.applyContextualFieldRules != null && rulesModule != null) {
      steps = wizardHost.applyContextualFieldRules({
        steps,
        draft: draft as unknown as Record<string, unknown>,
        rulesModule,
        evalContext: wizardRuleEvalContext ?? null,
      }) as typeof steps;
    }

    return steps;
  }, [
    baseSteps,
    templateSteps,
    allowedCanonicalPaths,
    pluginId,
    rulesModule,
    draft,
    wizardRuleEvalContext,
    wizardHost?.applyContextualFieldRules,
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

  const resumeAppliedRef = useRef(false);

  useEffect(() => {
    if (visibleSteps == null || visibleSteps.length === 0) {
      return;
    }
    if (wizardHost?.resolveInitialStepIndex == null) {
      return;
    }
    if (resumeAppliedRef.current) {
      return;
    }

    const saved = clampWizardStepIndex(activeStepIndex, visibleSteps.length);
    if (saved > 0) {
      resumeAppliedRef.current = true;
      return;
    }

    const inferred = wizardHost.resolveInitialStepIndex({
      draft: draft as unknown as Record<string, unknown>,
      visibleSteps,
      savedStepIndex: saved,
    });
    if (inferred === 0) {
      return;
    }

    resumeAppliedRef.current = true;
    setActiveStepIndex(inferred);
  }, [wizardHost, visibleSteps, activeStepIndex, draft, setActiveStepIndex]);

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
    focusOptions: {
      scrollBehavior: "smooth",
      scrollBlock: "center",
      highlight: true,
    },
  });

  const refreshReviewValidationIssues = useCallback(() => {
    if (workspacePlugin == null || wizardHost?.usesStepValidation !== true) {
      setReviewValidationIssues([]);
      return;
    }
    const validate = wizardHost.validateDraftSync;
    if (validate == null) {
      setReviewValidationIssues([]);
      return;
    }
    const result = validate({
      plugin: workspacePlugin,
      draft: draft as unknown as Record<string, unknown>,
      rulesModule: rulesModule,
      tenantId,
    });
    if (result.ok) {
      setReviewValidationIssues([]);
      return;
    }
    setReviewValidationIssues(
      mapValidationResultToIssues(result, { resolveStepId })
    );
  }, [workspacePlugin, wizardHost?.usesStepValidation, wizardHost?.validateDraftSync, draft, rulesModule, tenantId, resolveStepId]);

  useEffect(() => {
    if (visibleSteps == null) {
      return;
    }
    const activeStep = visibleSteps[clampWizardStepIndex(activeStepIndex, visibleSteps.length)];
    if (activeStep?.stepId === reviewStepId) {
      refreshReviewValidationIssues();
    }
  }, [visibleSteps, activeStepIndex, reviewStepId, refreshReviewValidationIssues, draft]);

  useEffect(() => {
    if (submitValidationIssues == null || submitValidationIssues.length === 0) {
      return;
    }
    setReviewValidationIssues(submitValidationIssues);
    const first = submitValidationIssues[0];
    if (first != null) {
      void (async () => {
        await focusIssue(first);
        onSubmitValidationHandled?.();
      })();
    }
  }, [submitValidationIssues, focusIssue, onSubmitValidationHandled]);

  useEffect(() => {
    if (stepNavValidationIssues.length > 0) {
      setStepNavValidationIssues([]);
    }
  }, [draft]);

  const handleBeforeNext = useCallback(
    async (currentIndex: number) => {
      if (workspacePlugin == null || visibleSteps == null || wizardHost?.usesStepValidation !== true) {
        return true;
      }
      const step = visibleSteps[currentIndex];
      if (step == null || (reviewStepId != null && step.stepId === reviewStepId)) {
        return true;
      }
      const validate = wizardHost.validateDraftSync;
      if (validate == null) {
        return true;
      }
      const result = validate({
        plugin: workspacePlugin,
        draft: draft as unknown as Record<string, unknown>,
        rulesModule: rulesModule,
        tenantId,
        scope: { stepId: step.stepId, visibleSteps },
      });
      if (result.ok) {
        setStepNavValidationIssues([]);
        return true;
      }
      const issues = mapValidationResultToIssues(result, { resolveStepId });
      setStepNavValidationIssues(issues);
      await focusFirstFromResult(result, { resolveStepId });
      return false;
    },
    [
      workspacePlugin,
      visibleSteps,
      wizardHost?.usesStepValidation,
      wizardHost?.validateDraftSync,
      reviewStepId,
      draft,
      rulesModule,
      tenantId,
      focusFirstFromResult,
      resolveStepId,
    ]
  );

  const handleFocusValidationIssue = useCallback(
    (stepId: string, path: string) => {
      void focusIssue({ path, message: "", stepId });
    },
    [focusIssue]
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

  const completionSnapshot =
    reviewSurface?.computeCompletion != null
      ? reviewSurface.computeCompletion(draft, visibleSteps)
      : null;

  return (
    <div
      className="workspace-wizard"
      data-workspace-wizard
      data-plugin-id={pluginId}
      {...(wizardHost?.hostRootDataAttributes ?? {})}
    >
      {completionSnapshot != null && reviewSurface?.renderCompletionHeader != null
        ? reviewSurface.renderCompletionHeader(completionSnapshot)
        : null}
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
            {stepNavValidationIssues.length > 0 ? (
              <div className="workspace-wizard__step-validation">
                {validationSurface.renderValidationSummary(
                  buildWizardValidationSurfaceProps({
                    issues: stepNavValidationIssues,
                    stepDescriptors,
                    onFocusIssue: handleFocusValidationIssue,
                    fieldLabelSurfaceId: wizardHost?.fieldLabelSurfaceId,
                    translateWorkspaceMessage,
                  })
                )}
              </div>
            ) : null}
            {wizardHost?.usesReviewStep === true &&
            reviewStepId != null &&
            activeStep.stepId === reviewStepId &&
            reviewSurface?.renderReviewChrome != null ? (
              reviewSurface.renderReviewChrome({
                draft,
                onDraftChange,
                reviewValidationIssues,
                stepDescriptors,
                onFocusIssue: handleFocusValidationIssue,
                fieldLabelSurfaceId: wizardHost?.fieldLabelSurfaceId,
                translateWorkspaceMessage,
              })
            ) : null}
            {activeStep.fields
              .filter(
                (field) =>
                  !(
                    wizardHost?.usesReviewStep === true &&
                    reviewStepId != null &&
                    activeStep.stepId === reviewStepId &&
                    field.canonicalPath === "publishStatus"
                  )
              )
              .map((field) => {
                const path = field.canonicalPath;
                const value = getCanonicalStringValue(draft, path);

                return (
                  <div
                    key={`${field.fieldId}:${path}`}
                    className="workspace-wizard__field"
                    {...wizardFieldPathAttributes(path, field.fieldId)}
                  >
                    <WizardField
                      field={field}
                      value={value}
                      onChange={(next) => onDraftChange(setCanonicalStringValue(draft, path, next))}
                      draft={draft}
                      onDraftChange={onDraftChange}
                      pluginId={pluginId}
                      compositeSurfaceId={wizardHost?.compositeSurfaceId}
                      fieldLabelSurfaceId={wizardHost?.fieldLabelSurfaceId}
                      wizardSessionId={wizardSessionId}
                      workspaceFormProfile={readWorkspaceFormProfileFromEvalContext(wizardRuleEvalContext)}
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
