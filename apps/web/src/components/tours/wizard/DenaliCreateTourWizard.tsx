"use client";

import { useDraftEngine } from "@repo/draft-engine";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Button, Card, CardBody } from "@tour/ui";

import { ApiError } from "@/lib/api-client";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { useDenaliTourWizardCreate } from "@/features/tours/wizard/hooks/useDenaliTourWizardCreate";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import { isWizardSubmitLocked } from "@/features/tours/wizard/wizardSubmitLock";
import {
  DenaliBasicInfoStep,
  DenaliPricingStep,
  DenaliProgramNatureStep,
  DenaliReviewStep,
  DenaliLogisticsStep,
  DenaliPhotosStep,
} from "@/features/tours/wizard/denali";
import {
  getDenaliStepTitleFa,
  type DenaliCreateWizardStepId,
} from "@/features/tours/wizard/denaliStepConfig";
import {
  getDenaliWizardVisibleSteps,
  prepareDenaliWizardFormForSubmit,
  resolveDenaliRuleSetFromTemplate,
  withDenaliWizardRailTestingOverrides,
} from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import { applyDenaliWizardStepValidation } from "@/features/tours/wizard/schemas/denaliTourCreateValidation";
import { createDenaliCanonicalWizardResolver } from "@/features/tours/wizard/schemas/denaliWizardCanonicalResolver";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliCore.schema";
import { DENALI_QUIET_FORM_RESET_OPTIONS } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { mergeDenaliFormDefaults } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { tryHydrateCanonicalTemplate } from "@/features/tours/wizard/denali/canonicalTemplateHydration";
import { sanitizeDenaliWizardCatalogRefs } from "@/features/tours/wizard/denali/sanitizeDenaliWizardCatalogRefs";
import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import { DenaliWizardSyncProvider } from "@/features/tours/wizard/denali/DenaliWizardSyncContext";
import { DenaliWizardNavigationProvider } from "@/features/tours/wizard/denali/DenaliWizardNavigationContext";
import { DenaliStepFocusBridge } from "@/features/tours/wizard/denali/DenaliStepFocusBridge";
import { DenaliWizardSubmitControl } from "@/features/tours/wizard/denali/DenaliWizardSubmitControl";
import { DenaliWizardContentQualityHeader } from "@/features/tours/wizard/denali/components/DenaliWizardHeader";
import { handleDenaliWizardValidationApiError } from "@/lib/errors/apply-api-validation-errors";
import { formatWizardApiErrorMessage } from "@/features/tours/wizard/format-wizard-api-error";
import { flattenDenaliFormErrors } from "@/features/tours/wizard/denali/flattenDenaliFormErrors";
import { scrollTourFormToFirstError } from "@/components/tours/tourFormValidationSummary";
import { QuickAddModalProvider } from "@/components/shared/QuickAddModal";
import { ErrorBoundary } from "@/layouts";
import {
  createDenaliDraftAdapter,
  isMeaningfulDenaliDraftSnapshot,
} from "@/features/tours/drafts/denali-adapter";

type CaptureExceptionLike = (_error: unknown, _context?: Record<string, unknown>) => void;

function reportDenaliDraftError(
  phase: "initialize" | "apply",
  error: unknown,
  context: Record<string, unknown>,
): void {
  const _message = error instanceof Error ? error.message : String(error);
  const sentry = (globalThis as { Sentry?: { captureException?: CaptureExceptionLike } }).Sentry;
  sentry?.captureException?.(error, {
    tags: { feature: "denali_draft_hydration", phase },
    extra: context,
  });
}

function DenaliWizardStepper({
  steps,
  currentIndex,
}: {
  steps: readonly DenaliCreateWizardStepId[];
  currentIndex: number;
}) {
  return (
    <ol
      aria-label="مراحل ایجاد تور Denali"
      style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", listStyle: "none", padding: 0, margin: 0 }}
    >
      {steps.map((step, index) => (
        <li key={step}>
          <span
            aria-current={index === currentIndex ? "step" : undefined}
            data-testid={`denali-wizard-step-${step}`}
            style={{
              display: "inline-block",
              padding: "0.2rem 0.65rem",
              borderRadius: 999,
              fontSize: "0.8rem",
              background:
                index === currentIndex
                  ? "var(--color-primary-100, #dbeafe)"
                  : "var(--color-surface-subtle, #eef2f7)",
              color: index === currentIndex ? "var(--color-primary-800, #1e3a8a)" : "#334155",
            }}
          >
            {index + 1}. {getDenaliStepTitleFa(step)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function DenaliStepBody({ stepId }: { stepId: DenaliCreateWizardStepId }) {
  let body: ReactNode = null;
  switch (stepId) {
    case "denali_basic":
      body = <DenaliBasicInfoStep />;
      break;
    case "denali_program":
      body = <DenaliProgramNatureStep />;
      break;
    case "denali_logistics":
      body = <DenaliLogisticsStep />;
      break;
    case "denali_pricing":
      body = <DenaliPricingStep />;
      break;
    case "denali_photos":
      body = <DenaliPhotosStep />;
      break;
    case "review":
      body = <DenaliReviewStep />;
      break;
  }
  return (
    <>
      <DenaliStepFocusBridge stepId={stepId} />
      {body}
    </>
  );
}

export function DenaliCreateTourWizard() {
  const t = useTranslations("tours.new");
  const router = useRouter();
  const workspaceId = useWorkspaceQueryScope();
  const wizardTemplateQuery = useTenantWizardTemplate();
  const themesQuery = useSettingsTourThemes();
  const destinationsQuery = useTourDestinations();
  const createMutation = useDenaliTourWizardCreate();
  const [currentStep, setCurrentStep] = useState(0);
  const [canonicalSyncToken, setCanonicalSyncToken] = useState(0);
  const [draftInitComplete, setDraftInitComplete] = useState(false);
  const [staleDraftNoticeOpen, setStaleDraftNoticeOpen] = useState(false);
  const [hasAppliedDraft, setHasAppliedDraft] = useState(false);

  const suppressDraftPushRef = useRef(false);
  const initialHydrateDoneRef = useRef(false);

  const workspaceFormProfile = useMemo(
    () =>
      wizardTemplateQuery.data
        ? resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data)
        : null,
    [wizardTemplateQuery.data],
  );
  const ruleSet = useMemo(
    () => resolveDenaliRuleSetFromTemplate(wizardTemplateQuery.data ?? null),
    [wizardTemplateQuery.data],
  );
  const defaultValues = useMemo(() => buildDenaliTourCreateDefaultValues(), []);

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const draftConfig = useMemo(
    () =>
      createDenaliDraftAdapter({
        workspaceId: workspaceId ?? "",
        getCurrentStepIndex: () => currentStepRef.current,
      }),
    [workspaceId],
  );

  const {
    state: draftState,
    setDraftData,
    retry: retryDraft,
    initialize: initializeDraft,
    applyDraft,
    clearDraft,
  } = useDraftEngine(draftConfig);

  const setDraftDataRef = useRef(setDraftData);
  setDraftDataRef.current = setDraftData;
  const draftStatusRef = useRef(draftState.status);
  draftStatusRef.current = draftState.status;
  const prevDraftStatusRef = useRef(draftState.status);

  const formDefaults = useMemo(() => {
    const templateBaseline = wizardTemplateQuery.data
      ? (tryHydrateCanonicalTemplate(
          wizardTemplateQuery.data.canonicalData,
          defaultValues,
          undefined,
          ruleSet,
        )?.formValues ?? defaultValues)
      : defaultValues;
    if (draftState.status !== "DRAFT_AVAILABLE" && draftState.data?.form) {
      return mergeDenaliFormDefaults(templateBaseline, draftState.data.form);
    }
    return templateBaseline;
  }, [defaultValues, draftState.data?.form, draftState.status, ruleSet, wizardTemplateQuery.data]);
  const emptyFormBaseline = useMemo(
    () =>
      wizardTemplateQuery.data
        ? (tryHydrateCanonicalTemplate(
            wizardTemplateQuery.data.canonicalData,
            defaultValues,
            undefined,
            ruleSet,
          )?.formValues ?? defaultValues)
        : defaultValues,
    [defaultValues, ruleSet, wizardTemplateQuery.data],
  );

  const formMethods = useForm<DenaliCreateTourWizardForm>({
    defaultValues: formDefaults,
    resolver: createDenaliCanonicalWizardResolver(undefined, () => ruleSet),
    mode: "onTouched",
  });
  const { getValues, setError, clearErrors, reset, watch } = formMethods;
  const isFormDirty = formMethods.formState.isDirty;
  const _tourTypeWatch = useWatch({ control: formMethods.control, name: "basicInfo.tourType" });
  const resetToEmptyForm = useCallback(() => {
    suppressDraftPushRef.current = true;
    reset(emptyFormBaseline, DENALI_QUIET_FORM_RESET_OPTIONS);
    setCurrentStep(0);
    setCanonicalSyncToken((token) => token + 1);
    setHasAppliedDraft(false);
    queueMicrotask(() => {
      suppressDraftPushRef.current = false;
    });
  }, [emptyFormBaseline, reset]);

  useEffect(() => {
    if (!workspaceId || !wizardTemplateQuery.data) {
      setDraftInitComplete(false);
      initialHydrateDoneRef.current = false;
      return;
    }
    let cancelled = false;
    setDraftInitComplete(false);
    initialHydrateDoneRef.current = false;
    void (async () => {
      try {
        await initializeDraft();
      } catch (error: unknown) {
        if (!cancelled) {
          reportDenaliDraftError("initialize", error, {
            workspaceId: workspaceId ?? null,
            wizardTemplateReady: Boolean(wizardTemplateQuery.data),
          });
          // MAP Phase 3 requirement: hydration failure should fall back to an empty form safely.
          resetToEmptyForm();
        }
      } finally {
        if (!cancelled) {
          setDraftInitComplete(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initializeDraft, resetToEmptyForm, workspaceId, wizardTemplateQuery.data]);

  useEffect(() => {
    if (!wizardTemplateQuery.data || !draftInitComplete || initialHydrateDoneRef.current) {
      return;
    }
    if (draftState.status === "DRAFT_AVAILABLE") {
      return;
    }
    suppressDraftPushRef.current = true;
    const stepFromDraft = draftState.data?.currentStepIndex ?? 0;
    reset(formDefaults, DENALI_QUIET_FORM_RESET_OPTIONS);
    setCurrentStep(stepFromDraft);
    setCanonicalSyncToken((token) => token + 1);
    initialHydrateDoneRef.current = true;
    queueMicrotask(() => {
      suppressDraftPushRef.current = false;
    });
  }, [
    draftInitComplete,
    draftState.data?.currentStepIndex,
    draftState.status,
    formDefaults,
    reset,
    wizardTemplateQuery.data,
  ]);

  useEffect(() => {
    const prevStatus = prevDraftStatusRef.current;
    prevDraftStatusRef.current = draftState.status;

    if (
      !wizardTemplateQuery.data ||
      !draftInitComplete ||
      prevStatus !== "CONFLICT_RESOLVING" ||
      draftState.status !== "IDLE" ||
      draftState.data == null
    ) {
      return;
    }

    setStaleDraftNoticeOpen(true);
    suppressDraftPushRef.current = true;
    const stepFromDraft = draftState.data.currentStepIndex ?? 0;
    reset(formDefaults, DENALI_QUIET_FORM_RESET_OPTIONS);
    setCurrentStep(stepFromDraft);
    setCanonicalSyncToken((token) => token + 1);
    queueMicrotask(() => {
      suppressDraftPushRef.current = false;
    });
  }, [
    draftInitComplete,
    draftState.data,
    draftState.status,
    formDefaults,
    reset,
    wizardTemplateQuery.data,
  ]);

  useEffect(() => {
    if (!workspaceId || !draftInitComplete) {
      return;
    }
    const subscription = watch((_values) => {
      if (suppressDraftPushRef.current) {
        return;
      }
      if (!isFormDirty) {
        return;
      }
      if (draftStatusRef.current === "CONFLICT_RESOLVING") {
        return;
      }
      setDraftDataRef.current(
        {
          form: getValues(),
          currentStepIndex: currentStepRef.current,
        },
        { source: "user" },
      );
    });
    return () => subscription.unsubscribe();
  }, [draftInitComplete, getValues, isFormDirty, watch, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !draftInitComplete || suppressDraftPushRef.current) {
      return;
    }
    if (draftStatusRef.current === "CONFLICT_RESOLVING") {
      return;
    }
    if (!isFormDirty) {
      return;
    }
    setDraftDataRef.current(
      {
        form: getValues(),
        currentStepIndex: currentStep,
      },
      { source: "user" },
    );
  }, [currentStep, draftInitComplete, getValues, isFormDirty, workspaceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host.endsWith(".localhost");
    if (!isLocalHost) return;

    type IntegrationWindow = Window & {
      __integrationApplyDenaliWizardPatch?: (_patch: Partial<DenaliCreateTourWizardForm>) => void;
    };
    const bridge = (patch: Partial<DenaliCreateTourWizardForm>) => {
      suppressDraftPushRef.current = true;
      reset(mergeDenaliFormDefaults(getValues(), patch), DENALI_QUIET_FORM_RESET_OPTIONS);
      setCanonicalSyncToken((token) => token + 1);
      queueMicrotask(() => {
        suppressDraftPushRef.current = false;
      });
    };
    (window as IntegrationWindow).__integrationApplyDenaliWizardPatch = bridge;
    return () => {
      delete (window as IntegrationWindow).__integrationApplyDenaliWizardPatch;
    };
  }, [getValues, reset]);

  const visibleSteps = useMemo(() => {
    const rawSteps = getDenaliWizardVisibleSteps(getValues(), ruleSet);
    return withDenaliWizardRailTestingOverrides(rawSteps, { enabled: true });
  }, [getValues, ruleSet]);

  useEffect(() => {
    if (currentStep >= visibleSteps.length) {
      setCurrentStep(Math.max(visibleSteps.length - 1, 0));
    }
  }, [currentStep, visibleSteps.length]);

  const activeStepId = visibleSteps[currentStep] ?? visibleSteps[0] ?? "denali_basic";
  const isLastStep = currentStep >= visibleSteps.length - 1;
  const navLocked =
    isWizardSubmitLocked(createMutation) || draftState.status === "CONFLICT_RESOLVING";
  const isDraftSyncing = draftState.status === "SYNCING";
  const isDraftPresent =
    draftState.status === "DRAFT_AVAILABLE" &&
    isMeaningfulDenaliDraftSnapshot(draftState.pendingDraft?.data ?? null);
  const draftBannerMode: "no_draft" | "draft_available" | "draft_applied" = !isDraftPresent
    ? "no_draft"
    : hasAppliedDraft
      ? "draft_applied"
      : "draft_available";

  const handleRetryDraft = useCallback(() => {
    void retryDraft();
  }, [retryDraft]);

  const handleLoadDraft = useCallback(() => {
    setHasAppliedDraft(true);
    try {
      const pending = draftState.pendingDraft?.data ?? null;
      if (pending?.form) {
        suppressDraftPushRef.current = true;
        reset(mergeDenaliFormDefaults(emptyFormBaseline, pending.form), DENALI_QUIET_FORM_RESET_OPTIONS);
        setCurrentStep(pending.currentStepIndex ?? 0);
        setCanonicalSyncToken((token) => token + 1);
        queueMicrotask(() => {
          suppressDraftPushRef.current = false;
        });
      }
      applyDraft();
    } catch (error: unknown) {
      reportDenaliDraftError("apply", error, {
        workspaceId: workspaceId ?? null,
        draftStatus: draftStatusRef.current,
      });
      resetToEmptyForm();
    }
  }, [applyDraft, draftState.pendingDraft?.data, emptyFormBaseline, reset, resetToEmptyForm, workspaceId]);

  const handleDiscardDraft = useCallback(() => {
    setHasAppliedDraft(false);
    void clearDraft();
  }, [clearDraft]);

  const handleNext = () => {
    const form = getValues();
    const valid = applyDenaliWizardStepValidation(form, activeStepId, setError, clearErrors, undefined, ruleSet);
    if (!valid) {
      const flat = flattenDenaliFormErrors(formMethods.formState.errors);
      scrollTourFormToFirstError(
        flat.map((entry) => ({ path: entry.path, label: entry.path, message: entry.message })),
      );
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, Math.max(visibleSteps.length - 1, 0)));
  };

  const handlePrev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleSubmit = async (values: DenaliCreateTourWizardForm) => {
    if (workspaceFormProfile == null) {
      setError("root", { type: "manual", message: "Tour form profile is unavailable." });
      return;
    }
    try {
      const prepared = prepareDenaliWizardFormForSubmit(values, ruleSet);
      const invariant = applyDenaliInvariantState(prepared, undefined, ruleSet);
      const destinationIds = new Set(destinationsQuery.destinations.map((d) => d.id));
      const themeIds = new Set((themesQuery.data ?? []).map((d) => d.id));
      const sanitized = sanitizeDenaliWizardCatalogRefs(invariant, { destinationIds, themeIds }).form;

      await createMutation.mutateAsync({
        values: sanitized,
        ruleSet,
        workspaceFormProfile,
        themeCatalog: themesQuery.data?.map((theme) => ({ id: theme.id, name: theme.name })),
      });

      router.push("/tours");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        const handled = handleDenaliWizardValidationApiError(error, setError);
        if (handled) {
          const flat = flattenDenaliFormErrors(formMethods.formState.errors);
          scrollTourFormToFirstError(
            flat.map((entry) => ({ path: entry.path, label: entry.path, message: entry.message })),
          );
          return;
        }
      }
      setError("root", {
        type: "server",
        message: formatWizardApiErrorMessage(error, t("mutationGenericFailed")),
      });
    }
  };

  return (
    <QuickAddModalProvider>
      <FormProvider {...formMethods}>
      <DenaliCanonicalProvider
        formMethods={formMethods}
        syncToken={canonicalSyncToken}
        wizardTemplate={wizardTemplateQuery.data ?? null}
        workspaceFormProfile={workspaceFormProfile ?? undefined}
        draftStatus={draftState.status}
      >
        <DenaliWizardSyncProvider isSyncing={isDraftSyncing}>
          <DenaliWizardNavigationProvider
            visibleSteps={visibleSteps}
            currentStepIndex={currentStep}
            setCurrentStep={setCurrentStep}
          >
            <ErrorBoundary>
            <Card data-testid="denali-create-tour-wizard">
              <CardBody style={{ display: "grid", gap: "1rem" }}>
                <DenaliWizardContentQualityHeader />
                {draftBannerMode === "draft_available" ? (
                  <div
                    role="status"
                    data-testid="denali-draft-restore-banner"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--color-surface-subtle, #eef2f7)",
                    }}
                  >
                    <span>{t("draftRestoreBanner")}</span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        data-testid="denali-draft-restore-load"
                        onClick={handleLoadDraft}
                      >
                        {t("draftRestoreLoad")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid="denali-draft-restore-discard"
                        onClick={handleDiscardDraft}
                      >
                        {t("draftRestoreDiscard")}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {draftBannerMode === "draft_applied" ? (
                  <div
                    role="status"
                    data-testid="denali-draft-applied-banner"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--color-surface-subtle, #eef2f7)",
                    }}
                  >
                    <span>{t("draftRestoreBanner")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid="denali-draft-applied-reset"
                      onClick={handleDiscardDraft}
                    >
                      {t("draftRestoreDiscard")}
                    </Button>
                  </div>
                ) : null}
                <DenaliWizardStepper steps={visibleSteps} currentIndex={currentStep} />
                <DenaliStepBody stepId={activeStepId} />

                {staleDraftNoticeOpen ? (
                  <div
                    role="status"
                    data-testid="denali-draft-stale-notice"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--color-warning-50, #fffbeb)",
                      border: "1px solid var(--color-warning-200, #fde68a)",
                      color: "var(--color-warning-900, #78350f)",
                    }}
                  >
                    <span>{t("draftStaleConflictNotice")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStaleDraftNoticeOpen(false)}
                    >
                      {t("draftStaleConflictDismiss")}
                    </Button>
                  </div>
                ) : null}

                {draftState.status === "ERROR" ? (
                  <div
                    role="alert"
                    data-testid="denali-draft-save-error"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.5rem",
                      color: "var(--color-danger-700, #b91c1c)",
                    }}
                  >
                    <span>{t("draftSaveFailed")}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={handleRetryDraft}>
                      {t("draftRetry")}
                    </Button>
                  </div>
                ) : null}

                {formMethods.formState.errors.root?.message ? (
                  <p role="alert" style={{ color: "var(--color-danger-700, #b91c1c)", margin: 0 }}>
                    {formMethods.formState.errors.root.message}
                  </p>
                ) : null}

                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <Button type="button" variant="ghost" onClick={handlePrev} disabled={navLocked || currentStep === 0}>
                    Back
                  </Button>
                  {isLastStep ? (
                    <DenaliWizardSubmitControl
                      navLocked={navLocked}
                      isPending={createMutation.isPending}
                      pendingLabel={t("submitting")}
                      submitLabel={t("submit")}
                      ruleSet={ruleSet}
                      visibleSteps={visibleSteps}
                      onSubmit={handleSubmit}
                    />
                  ) : (
                    <Button type="button" variant="primary" onClick={handleNext} disabled={navLocked}>
                      Next
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
            </ErrorBoundary>
          </DenaliWizardNavigationProvider>
        </DenaliWizardSyncProvider>
      </DenaliCanonicalProvider>
    </FormProvider>
    </QuickAddModalProvider>
  );
}
