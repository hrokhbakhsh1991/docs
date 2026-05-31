"use client";

import { useDraftEngine } from "@repo/draft-engine";
import { DEFAULT_TOUR_FORM_PROFILE } from "@repo/types";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Button, Card, CardBody } from "@tour/ui";

import { ApiError } from "@/lib/api-client";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { useDenaliTourWizardCreate } from "@/features/tours/wizard/hooks/useDenaliTourWizardCreate";
import { resolveWizardRailId } from "@/features/tours/wizard/workspace-wizard.config";
import type { WizardSessionBlueprint } from "@/features/tours/wizard/wizard-session-blueprint.types";
import { isWizardSubmitLocked } from "@/features/tours/wizard/wizardSubmitLock";
import { clearWizardSubmitIdempotencyKey } from "@/features/tours/wizard/wizardSubmitSession";
import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import {
  prepareDenaliWizardFormForSubmit,
  resolveDenaliRuleSetFromTemplate,
} from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import { DENALI_QUIET_FORM_RESET_OPTIONS } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import {
  getWizardLayout,
  isNavigationLocked,
  resolveVisibleSteps,
  type UiContextOptions,
} from "@/features/tours/wizard/shell/layout";
import { LayoutProvider, WizardStepBody } from "@/features/tours/wizard/shell/context";
import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import { applyDenaliWizardStepValidation } from "@/features/tours/wizard/schemas/denaliTourCreateValidation";
import { createDenaliCanonicalWizardResolver } from "@/features/tours/wizard/schemas/denaliWizardCanonicalResolver";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliCore.schema";
import { mergeDenaliFormDefaults } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { tryHydrateCanonicalTemplate } from "@/features/tours/wizard/denali/canonicalTemplateHydration";
import { revokeBlobUrlsFromDenaliForm } from "@/features/tours/wizard/denali/preserveDenaliWizardBlobMedia";
import { sanitizeDenaliWizardCatalogRefs } from "@/features/tours/wizard/denali/sanitizeDenaliWizardCatalogRefs";
import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import { DenaliWizardSyncProvider } from "@/features/tours/wizard/denali/DenaliWizardSyncContext";
import { DenaliWizardNavigationProvider } from "@/features/tours/wizard/denali/DenaliWizardNavigationContext";
import { DenaliWizardSubmitControl } from "@/features/tours/wizard/denali/DenaliWizardSubmitControl";
import { DenaliWizardContentQualityHeader } from "@/features/tours/wizard/denali/components/DenaliWizardHeader";
import { DenaliWizardHeaderPlugins } from "@/features/tours/wizard/denali/plugins/DenaliWizardHeaderPlugins";
import { denaliTemplateSelectorPlugin } from "@/features/tours/wizard/denali/plugins/DenaliTemplateSelectorPlugin";
import { denaliWizardClearAllPlugin } from "@/features/tours/wizard/denali/plugins/DenaliWizardClearAllPlugin";
import { resetWizardToRegistryDefaults } from "@repo/denali-domain";
import type { DenaliWizardHeaderPlugin } from "@/features/tours/wizard/denali/application/denaliWizardHeaderPlugin";
import { handleDenaliWizardValidationApiError } from "@/lib/errors/apply-api-validation-errors";
import { formatWizardApiErrorMessage } from "@/features/tours/wizard/format-wizard-api-error";
import { flattenDenaliFormErrors } from "@/features/tours/wizard/denali/flattenDenaliFormErrors";
import { focusDenaliWizardField } from "@/features/tours/wizard/denali/denaliWizardFieldFocus";
import {
  applyDenaliWizardIssuesToForm,
  evaluateDenaliWizardSubmitGate,
  focusDenaliSubmitValidationError,
  mergeDenaliActiveSubmitIssues,
} from "@/features/tours/wizard/denali/validation/denaliSubmitValidation";
import { scrollTourFormToFirstError } from "@/components/tours/tourFormValidationSummary";
import { QuickAddModalProvider } from "@/components/shared/QuickAddModal";
import { ErrorBoundary } from "@/layouts";
import {
  createDenaliDraftAdapter,
  isMeaningfulDenaliDraftSnapshot,
} from "@/features/tours/drafts/denali-adapter";

type CaptureExceptionLike = (_error: unknown, _context?: Record<string, unknown>) => void;

const SENSITIVE_TELEMETRY_HEADER_KEYS = new Set(["authorization", "cookie", "set-cookie"]);
const SENSITIVE_STRING_PATTERN = /(Bearer|Token)\s+\S+/gi;

function redactSensitiveStringFragments(text: string): string {
  return text.replace(SENSITIVE_STRING_PATTERN, "[REDACTED_STRING]");
}

function scrubSensitiveHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!SENSITIVE_TELEMETRY_HEADER_KEYS.has(key.toLowerCase())) {
      out[key] = value;
    }
  }
  return out;
}

function scrubSensitiveTelemetryValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (depth > 8) {
    return "[REDACTED_MAX_DEPTH_REACHED]";
  }
  if (value instanceof Error) {
    return scrubErrorForSentryCapture(value, depth + 1);
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveTelemetryValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_TELEMETRY_HEADER_KEYS.has(key.toLowerCase())) {
        continue;
      }
      if (key === "headers" && nested && typeof nested === "object") {
        out[key] = scrubSensitiveHeaders(nested as Record<string, unknown>);
        continue;
      }
      out[key] = scrubSensitiveTelemetryValue(nested, depth + 1);
    }
    return out;
  }
  return value;
}

function scrubErrorForSentryCapture(error: Error, depth = 0): Error {
  const scrubbed = new Error(redactSensitiveStringFragments(error.message));
  scrubbed.name = error.name;
  if (error.stack) {
    scrubbed.stack = redactSensitiveStringFragments(error.stack);
  }
  if ("cause" in error && error.cause !== undefined) {
    scrubbed.cause = scrubSensitiveTelemetryValue(error.cause, depth + 1);
  }
  for (const key of Object.getOwnPropertyNames(error)) {
    if (key === "message" || key === "name" || key === "stack" || key === "cause") {
      continue;
    }
    try {
      (scrubbed as unknown as Record<string, unknown>)[key] = scrubSensitiveTelemetryValue(
        (error as unknown as Record<string, unknown>)[key],
        depth + 1,
      );
    } catch {
      /* ignore non-readable error properties */
    }
  }
  return scrubbed;
}

function reportDenaliDraftError(
  railId: string,
  phase: "initialize" | "apply",
  error: unknown,
  context: Record<string, unknown>,
): void {
  const sanitizedError =
    error instanceof Error ? scrubErrorForSentryCapture(error) : scrubSensitiveTelemetryValue(error);
  const sanitizedContext = scrubSensitiveTelemetryValue(context) as Record<string, unknown>;
  const sentry = (globalThis as { Sentry?: { captureException?: CaptureExceptionLike } }).Sentry;
  sentry?.captureException?.(sanitizedError, {
    tags: { feature: `${railId}_draft_hydration`, phase },
    extra: sanitizedContext,
  });
}

/** Create-wizard header plugins (basic step only). Edit form registers none. */
const CREATE_PLUGINS: readonly DenaliWizardHeaderPlugin[] = [
  denaliTemplateSelectorPlugin,
  denaliWizardClearAllPlugin,
];

function WorkspaceWizardStepper({
  steps,
  currentIndex,
}: {
  steps: readonly string[];
  currentIndex: number;
}) {
  const t = useTranslations("tours.new");

  return (
    <ol
      aria-label={t("wizard.ariaStepper")}
      style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", listStyle: "none", padding: 0, margin: 0 }}
    >
      {steps.map((stepId, index) => (
        <li key={stepId}>
          <span
            aria-current={index === currentIndex ? "step" : undefined}
            data-testid={`workspace-wizard-step-${stepId}`}
            style={{
              display: "inline-block",
              padding: "0.2rem 0.65rem",
              borderRadius: 999,
              fontSize: "0.8rem",
              background:
                index === currentIndex
                  ? "var(--color-primary-100)"
                  : "var(--color-surface-subtle)",
              color: index === currentIndex ? "var(--color-primary-800)" : "var(--color-slate-700)",
            }}
          >
            {index + 1}. {t(`wizard.steps.${stepId}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function WorkspaceTourWizard({
  sessionBlueprint,
}: {
  sessionBlueprint: WizardSessionBlueprint;
}) {
  const t = useTranslations("tours.new");
  const tDenali = useTranslations("tours.denali");
  const router = useRouter();
  const workspaceId = useWorkspaceQueryScope();
  const pinnedTemplate = sessionBlueprint.template;
  const themesQuery = useSettingsTourThemes();
  const destinationsQuery = useTourDestinations();
  const createMutation = useDenaliTourWizardCreate();
  const [currentStep, setCurrentStep] = useState(0);
  const [canonicalSyncToken, setCanonicalSyncToken] = useState(0);
  const [draftInitComplete, setDraftInitComplete] = useState(false);
  const [staleDraftNoticeOpen, setStaleDraftNoticeOpen] = useState(false);
  const [hasAppliedDraft, setHasAppliedDraft] = useState(false);
  const [stepBusy, setStepBusy] = useState(false);

  const isHydratingDraftRef = useRef(false);
  const initialHydrateDoneRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const stagingTourIdRef = useRef<string | null>(null);

  const workspaceFormProfile = sessionBlueprint.profile;
  const resolvedProfile = workspaceFormProfile ?? DEFAULT_TOUR_FORM_PROFILE;
  const resolvedRailId = resolveWizardRailId(workspaceFormProfile);
  const shellLayout = useMemo(
    () => getWizardLayout(resolvedProfile, pinnedTemplate),
    [resolvedProfile, pinnedTemplate],
  );
  const ruleSet = useMemo(
    () => resolveDenaliRuleSetFromTemplate(pinnedTemplate),
    [pinnedTemplate],
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
    const templateBaseline =
      tryHydrateCanonicalTemplate(
        pinnedTemplate.canonicalData,
        defaultValues,
        undefined,
        ruleSet,
      )?.formValues ?? defaultValues;
    if (draftState.status !== "DRAFT_AVAILABLE" && draftState.data?.form) {
      return mergeDenaliFormDefaults(templateBaseline, draftState.data.form);
    }
    return templateBaseline;
  }, [defaultValues, draftState.data?.form, draftState.status, ruleSet, pinnedTemplate]);
  const emptyFormBaseline = useMemo(
    () =>
      tryHydrateCanonicalTemplate(
        pinnedTemplate.canonicalData,
        defaultValues,
        undefined,
        ruleSet,
      )?.formValues ?? defaultValues,
    [defaultValues, ruleSet, pinnedTemplate],
  );

  const formMethods = useForm<DenaliCreateTourWizardForm>({
    defaultValues: formDefaults,
    resolver: createDenaliCanonicalWizardResolver(undefined, () => ruleSet),
    mode: "onTouched",
  });
  const { getValues, setError, clearErrors, reset, watch } = formMethods;
  const formMethodsRef = useRef(formMethods);
  formMethodsRef.current = formMethods;
  const getValuesRef = useRef(getValues);
  getValuesRef.current = getValues;
  const _tourTypeWatch = useWatch({ control: formMethods.control, name: "basicInfo.tourType" });

  /** Block draft persistence while programmatic reset/hydrate runs (visible in React DevTools). */
  const withDraftHydration = useCallback((fn: () => void) => {
    isHydratingDraftRef.current = true;
    try {
      fn();
    } finally {
      isHydratingDraftRef.current = false;
    }
  }, []);

  const withDraftHydrationAsync = useCallback(async (fn: () => Promise<void>) => {
    isHydratingDraftRef.current = true;
    try {
      await fn();
    } finally {
      isHydratingDraftRef.current = false;
    }
  }, []);

  const resetToEmptyForm = useCallback(() => {
    withDraftHydration(() => {
      revokeBlobUrlsFromDenaliForm(getValues());
      reset(emptyFormBaseline, DENALI_QUIET_FORM_RESET_OPTIONS);
      setCurrentStep(0);
      // Bumps canonical sync — DenaliCanonicalProvider clears staging uploadTourId (EC-RESET-01).
      setCanonicalSyncToken((token) => token + 1);
      setHasAppliedDraft(false);
    });
  }, [emptyFormBaseline, getValues, reset, withDraftHydration]);

  const handleClearAll = useCallback(async () => {
    await withDraftHydrationAsync(async () => {
      revokeBlobUrlsFromDenaliForm(getValues());
      reset(resetWizardToRegistryDefaults(), DENALI_QUIET_FORM_RESET_OPTIONS);
      setCurrentStep(0);
      // Bumps canonical sync — DenaliCanonicalProvider clears staging uploadTourId (EC-RESET-01).
      setCanonicalSyncToken((token) => token + 1);
      setHasAppliedDraft(false);
      await clearDraft();
    });
  }, [clearDraft, getValues, reset, withDraftHydrationAsync]);

  useEffect(() => {
    if (!workspaceId || !pinnedTemplate) {
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
          reportDenaliDraftError(resolvedRailId, "initialize", error, {
            workspaceId: workspaceId ?? null,
            wizardTemplateReady: Boolean(pinnedTemplate),
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
  }, [initializeDraft, pinnedTemplate, resetToEmptyForm, resolvedRailId, workspaceId]);

  useEffect(() => {
    if (!pinnedTemplate || !draftInitComplete || initialHydrateDoneRef.current) {
      return;
    }
    if (draftState.status === "DRAFT_AVAILABLE") {
      return;
    }
    withDraftHydration(() => {
      const stepFromDraft = draftState.data?.currentStepIndex ?? 0;
      reset(formDefaults, DENALI_QUIET_FORM_RESET_OPTIONS);
      setCurrentStep(stepFromDraft);
      setCanonicalSyncToken((token) => token + 1);
      initialHydrateDoneRef.current = true;
    });
  }, [
    draftInitComplete,
    draftState.data?.currentStepIndex,
    draftState.status,
    formDefaults,
    pinnedTemplate,
    reset,
    withDraftHydration,
  ]);

  useEffect(() => {
    const prevStatus = prevDraftStatusRef.current;
    prevDraftStatusRef.current = draftState.status;

    if (
      !pinnedTemplate ||
      !draftInitComplete ||
      prevStatus !== "CONFLICT_RESOLVING" ||
      draftState.status !== "IDLE" ||
      draftState.data == null
    ) {
      return;
    }

    const mergedDraft = draftState.data;
    setStaleDraftNoticeOpen(true);
    withDraftHydration(() => {
      const stepFromDraft = mergedDraft.currentStepIndex ?? 0;
      reset(formDefaults, DENALI_QUIET_FORM_RESET_OPTIONS);
      setCurrentStep(stepFromDraft);
      setCanonicalSyncToken((token) => token + 1);
    });
  }, [
    draftInitComplete,
    draftState.data,
    draftState.status,
    formDefaults,
    pinnedTemplate,
    reset,
    withDraftHydration,
  ]);

  const pushDraftUserEditRef = useRef<() => void>(() => undefined);
  pushDraftUserEditRef.current = () => {
    if (isHydratingDraftRef.current || isSubmittingRef.current) {
      return;
    }
    if (!formMethodsRef.current.formState.isDirty) {
      return;
    }
    if (draftStatusRef.current === "CONFLICT_RESOLVING") {
      return;
    }
    setDraftDataRef.current(
      {
        form: getValuesRef.current(),
        currentStepIndex: currentStepRef.current,
      },
      { source: "user" },
    );
  };

  useEffect(() => {
    if (!workspaceId || !draftInitComplete) {
      return;
    }
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const subscription = watch(() => {
      if (debounceTimer != null) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        pushDraftUserEditRef.current();
      }, shellLayout.draftWatchDebounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimer != null) {
        clearTimeout(debounceTimer);
      }
    };
  }, [draftInitComplete, shellLayout.draftWatchDebounceMs, watch, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !draftInitComplete || isHydratingDraftRef.current) {
      return;
    }
    if (draftStatusRef.current === "CONFLICT_RESOLVING") {
      return;
    }
    if (!formMethodsRef.current.formState.isDirty) {
      return;
    }
    setDraftDataRef.current(
      {
        form: getValuesRef.current(),
        currentStepIndex: currentStep,
      },
      { source: "user" },
    );
  }, [currentStep, draftInitComplete, workspaceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host.endsWith(".localhost");
    if (!isLocalHost) return;

    type IntegrationWindow = Window & {
      __integrationApplyDenaliWizardPatch?: (_patch: Partial<DenaliCreateTourWizardForm>) => void;
    };
    const bridge = (patch: Partial<DenaliCreateTourWizardForm>) => {
      withDraftHydration(() => {
        reset(mergeDenaliFormDefaults(getValues(), patch), DENALI_QUIET_FORM_RESET_OPTIONS);
        setCanonicalSyncToken((token) => token + 1);
      });
    };
    (window as IntegrationWindow).__integrationApplyDenaliWizardPatch = bridge;
    return () => {
      delete (window as IntegrationWindow).__integrationApplyDenaliWizardPatch;
    };
  }, [getValues, reset, withDraftHydration]);

  const visibleSteps = useMemo(() => {
    return resolveVisibleSteps(shellLayout, getValues(), ruleSet) as readonly DenaliCreateWizardStepId[];
  // `getValues` is stable; `_tourTypeWatch` recomputes visible steps when tour kind changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tour kind watch invalidates memo
  }, [_tourTypeWatch, getValues, ruleSet, shellLayout]);

  useEffect(() => {
    if (currentStep >= visibleSteps.length) {
      setCurrentStep(Math.max(visibleSteps.length - 1, 0));
    }
  }, [currentStep, visibleSteps.length]);

  const activeStepId =
    visibleSteps[currentStep] ?? visibleSteps[0] ?? shellLayout.stepRail.stepIds[0] ?? "";
  const isLastStep = currentStep >= visibleSteps.length - 1;
  const navLocked = isNavigationLocked({
    layout: shellLayout,
    submitLocked: isWizardSubmitLocked(createMutation),
    draftStatus: draftState.status,
  });
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
        withDraftHydration(() => {
          reset(mergeDenaliFormDefaults(emptyFormBaseline, pending.form), DENALI_QUIET_FORM_RESET_OPTIONS);
          setCurrentStep(pending.currentStepIndex ?? 0);
          setCanonicalSyncToken((token) => token + 1);
        });
      }
      applyDraft();
    } catch (error: unknown) {
      reportDenaliDraftError(resolvedRailId, "apply", error, {
        workspaceId: workspaceId ?? null,
        draftStatus: draftStatusRef.current,
      });
      resetToEmptyForm();
    }
  }, [applyDraft, draftState.pendingDraft?.data, emptyFormBaseline, reset, resetToEmptyForm, resolvedRailId, withDraftHydration, workspaceId]);

  const handleDiscardDraft = useCallback(() => {
    setHasAppliedDraft(false);
    void clearDraft();
  }, [clearDraft]);

  const handleNext = () => {
    if (stepBusy || navLocked) {
      return;
    }
    setStepBusy(true);
    try {
      const form = getValues();
      const uiOptions: UiContextOptions | undefined = workspaceFormProfile
        ? { workspaceFormProfile }
        : undefined;
      // EC-ZOD-04: evict RHF errors on fields hidden by the rule model before validating this step.
      const valid = applyDenaliWizardStepValidation(
        form,
        activeStepId as DenaliCreateWizardStepId,
        setError,
        clearErrors,
        shellLayout,
        uiOptions,
        ruleSet,
      );
      if (!valid) {
        const flat = flattenDenaliFormErrors(formMethods.formState.errors);
        scrollTourFormToFirstError(
          flat.map((entry) => ({ path: entry.path, label: entry.path, message: entry.message })),
        );
        return;
      }
      setCurrentStep((prev) => Math.min(prev + 1, Math.max(visibleSteps.length - 1, 0)));
    } finally {
      setStepBusy(false);
    }
  };

  const handlePrev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const focusFirstSubmitError = useCallback(
    (
      prepared: DenaliCreateTourWizardForm,
      submitIssues: ReturnType<typeof mergeDenaliActiveSubmitIssues>,
      publishIssues: ReturnType<typeof evaluateDenaliWizardSubmitGate>["publishIssues"],
    ) => {
      focusDenaliSubmitValidationError({
        form: prepared,
        ruleSet,
        submitIssues,
        publishIssues,
        t: tDenali,
        onFocusField: (stepId, formPath) => {
          const stepIndex = visibleSteps.indexOf(stepId);
          if (stepIndex >= 0) {
            setCurrentStep(() => stepIndex);
          }
          window.scrollTo(0, 0);
          window.requestAnimationFrame(() => {
            window.setTimeout(() => focusDenaliWizardField(formPath), 50);
          });
        },
      });
    },
    [ruleSet, tDenali, visibleSteps],
  );

  const handleSubmit = async (values: DenaliCreateTourWizardForm) => {
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    try {
      if (workspaceFormProfile == null) {
        setError("root", { type: "manual", message: t("wizard.profileUnavailable") });
        return;
      }

      const prepared = prepareDenaliWizardFormForSubmit(values, ruleSet);
      const gate = evaluateDenaliWizardSubmitGate(prepared, {
        ruleSet,
        profile: workspaceFormProfile,
      });

      if (gate.tourStatus === "active" && !gate.success) {
        const blockingIssues = mergeDenaliActiveSubmitIssues(gate.submitIssues, gate.publishIssues);
        applyDenaliWizardIssuesToForm(setError, blockingIssues);
        setError("root", {
          type: "manual",
          message: tDenali("review.publishSubmitBlocked"),
        });
        focusFirstSubmitError(prepared, gate.submitIssues, gate.publishIssues);
        return;
      }

      const invariant = applyDenaliInvariantState(prepared, undefined, ruleSet);
      const destinationIds = new Set(destinationsQuery.destinations.map((d) => d.id));
      const themeIds = new Set((themesQuery.data ?? []).map((d) => d.id));
      const sanitized = sanitizeDenaliWizardCatalogRefs(invariant, { destinationIds, themeIds }).form;

      await createMutation.mutateAsync({
        values: sanitized,
        ruleSet,
        workspaceFormProfile,
        themeCatalog: themesQuery.data?.map((theme) => ({ id: theme.id, name: theme.name })),
        stagingTourId: stagingTourIdRef.current ?? undefined,
      });
      await clearDraft();
      setCanonicalSyncToken((token) => token + 1);
      clearWizardSubmitIdempotencyKey(workspaceId ?? undefined);
      router.push("/tours");
      router.refresh();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const gate = evaluateDenaliWizardSubmitGate(getValues(), {
          ruleSet,
          profile: workspaceFormProfile ?? DEFAULT_TOUR_FORM_PROFILE,
        });
        const blockingIssues = mergeDenaliActiveSubmitIssues(gate.submitIssues, gate.publishIssues);
        applyDenaliWizardIssuesToForm(setError, blockingIssues);
        setError("root", {
          type: "manual",
          message: tDenali("review.publishSubmitBlocked"),
        });
        focusFirstSubmitError(getValues(), gate.submitIssues, gate.publishIssues);
        return;
      }
      if (error instanceof ApiError) {
        if (error.code === "IDEMPOTENCY_REQUEST_IN_PROGRESS") {
          setError("root", {
            type: "server",
            message: "این درخواست در حال پردازش است، لطفاً کمی صبر کنید.",
          });
          return;
        }
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
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const stepRailEmpty = shellLayout.stepRail.stepIds.length === 0;
  if (visibleSteps.length === 0 || stepRailEmpty) {
    if (currentStep !== 0) {
      setCurrentStep(0);
    }
    return (
      <Card data-testid="workspace-tour-wizard-empty-rail">
        <CardBody>
          <div
            role="alert"
            data-testid="workspace-wizard-empty-rail-banner"
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--color-border-danger, #f5c2c7)",
              background: "var(--color-surface-danger-subtle, #f8d7da)",
              color: "var(--color-text-danger, #842029)",
            }}
          >
            This workspace profile contains no visible step configurations. Please contact your
            administrator.
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <QuickAddModalProvider>
      <FormProvider {...formMethods}>
      <LayoutProvider layout={shellLayout}>
      <DenaliCanonicalProvider
        formMethods={formMethods}
        syncToken={canonicalSyncToken}
        wizardTemplate={pinnedTemplate}
        workspaceFormProfile={workspaceFormProfile ?? undefined}
        draftStatus={draftState.status}
        stagingTourIdRef={stagingTourIdRef}
      >
        <DenaliWizardSyncProvider isSyncing={isDraftSyncing}>
          <DenaliWizardNavigationProvider
            visibleSteps={visibleSteps}
            currentStepIndex={currentStep}
            setCurrentStep={setCurrentStep}
          >
            <ErrorBoundary>
            <Card
              data-testid="workspace-tour-wizard"
              data-wizard-rail={resolvedRailId}
              data-resolved-form-profile={workspaceFormProfile ?? undefined}
              data-wizard-step-count={String(visibleSteps.length)}
            >
              <CardBody style={{ display: "grid", gap: "1rem" }}>
                <DenaliWizardContentQualityHeader />
                <DenaliWizardHeaderPlugins
                  plugins={CREATE_PLUGINS}
                  context={{
                    activeStepId,
                    formMethods,
                    ruleSet,
                    workspaceFormProfile: workspaceFormProfile ?? undefined,
                    onCanonicalSync: () => setCanonicalSyncToken((token) => token + 1),
                    onClearForm: resetToEmptyForm,
                    onClearAll: handleClearAll,
                  }}
                />
                {draftBannerMode === "draft_available" ? (
                  <div
                    role="status"
                    data-testid="workspace-draft-restore-banner"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--color-surface-subtle)",
                    }}
                  >
                    <span>{t("draftRestoreBanner")}</span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        data-testid="workspace-draft-restore-load"
                        onClick={handleLoadDraft}
                      >
                        {t("draftRestoreLoad")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid="workspace-draft-restore-discard"
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
                    data-testid="workspace-draft-applied-banner"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--color-surface-subtle)",
                    }}
                  >
                    <span>{t("draftRestoreBanner")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid="workspace-draft-applied-reset"
                      onClick={handleDiscardDraft}
                    >
                      {t("draftRestoreDiscard")}
                    </Button>
                  </div>
                ) : null}
                <WorkspaceWizardStepper steps={visibleSteps} currentIndex={currentStep} />
                <WizardStepBody stepId={activeStepId} />

                {staleDraftNoticeOpen ? (
                  <div
                    role="status"
                    data-testid="workspace-draft-stale-notice"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      background: "var(--color-warning-50)",
                      border: "1px solid var(--color-warning-200)",
                      color: "var(--color-warning-900)",
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
                    data-testid="workspace-draft-save-error"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.5rem",
                      color: "var(--color-danger-700)",
                    }}
                  >
                    <span>{t("draftSaveFailed")}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={handleRetryDraft}>
                      {t("draftRetry")}
                    </Button>
                  </div>
                ) : null}

                {formMethods.formState.errors.root?.message ? (
                  <p role="alert" style={{ color: "var(--color-danger-700)", margin: 0 }}>
                    {formMethods.formState.errors.root.message}
                  </p>
                ) : null}

                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <Button type="button" variant="ghost" onClick={handlePrev} disabled={navLocked || currentStep === 0}>
                    {t("wizard.back")}
                  </Button>
                  {isLastStep ? (
                    <DenaliWizardSubmitControl
                      navLocked={navLocked}
                      isPending={createMutation.isPending}
                      pendingLabel={t("submitting")}
                      submitLabel={t("submit")}
                      ruleSet={ruleSet}
                      onSubmit={handleSubmit}
                    />
                  ) : (
                    <Button type="button" variant="primary" onClick={handleNext} disabled={navLocked || stepBusy}>
                      {t("wizard.next")}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
            </ErrorBoundary>
          </DenaliWizardNavigationProvider>
        </DenaliWizardSyncProvider>
      </DenaliCanonicalProvider>
      </LayoutProvider>
    </FormProvider>
    </QuickAddModalProvider>
  );
}
