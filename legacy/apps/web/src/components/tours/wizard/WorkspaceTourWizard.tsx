"use client";

import { useDraftEngine } from "@repo/draft-engine";
import { DEFAULT_TOUR_FORM_PROFILE } from "@repo/types";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Button, Card, CardBody, cn } from "@tour/ui";

import alertStyles from "./workspace-tour-wizard-alerts.module.css";

import { ApiError } from "@/lib/api-client";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { useDenaliTourWizardCreate } from "@/features/tours/wizard/hooks/useDenaliTourWizardCreate";
import { useInstantiateWorkspaceTemplate } from "@/features/tours/wizard/hooks/useInstantiateWorkspaceTemplate";
import { resolveWizardRailId } from "@/features/tours/wizard/workspace-wizard.config";
import type { WizardSessionBlueprint } from "@/features/tours/wizard/wizard-session-blueprint.types";
import { isWizardSubmitLocked } from "@/features/tours/wizard/wizardSubmitLock";
import { clearWizardSubmitIdempotencyKey } from "@/features/tours/wizard/wizardSubmitSession";
import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import { resolveDenaliRuleSetFromTemplate } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import { DENALI_QUIET_FORM_RESET_OPTIONS } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import {
  getWizardLayout,
  isNavigationLocked,
  resolveVisibleSteps,
  type UiContextOptions,
} from "@/features/tours/wizard/shell/layout";
import { LayoutProvider, WizardStepBody } from "@/features/tours/wizard/shell/context";
import { applyDenaliWizardStepValidation } from "@/features/tours/wizard/schemas/denaliTourCreateValidation";
import { createDenaliCanonicalWizardResolver } from "@/features/tours/wizard/schemas/denaliWizardCanonicalResolver";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliCore.schema";
import { mergeDenaliFormDefaults } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { finalizeDenaliWizardHydration } from "@repo/denali-domain";
import { revokeBlobUrlsFromDenaliForm } from "@/features/tours/wizard/denali/preserveDenaliWizardBlobMedia";
import { prepareDenaliSubmitArtifact } from "@/features/tours/wizard/domain/submit-orchestrator";
import {
  DenaliProductionErrorCode,
  HydrationParityError,
} from "@/features/tours/wizard/errors/denali-production-errors";
import { LoggerService } from "@/lib/logging/logger.service";
import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import { DenaliWizardSyncProvider } from "@/features/tours/wizard/denali/DenaliWizardSyncContext";
import { DenaliWizardNavigationProvider } from "@/features/tours/wizard/denali/DenaliWizardNavigationContext";
import { DenaliWizardSubmitControl } from "@/features/tours/wizard/denali/DenaliWizardSubmitControl";
import { DenaliWizardContentQualityHeader } from "@/features/tours/wizard/denali/components/DenaliWizardHeader";
import { DenaliWizardHeaderPlugins } from "@/features/tours/wizard/denali/plugins/DenaliWizardHeaderPlugins";
import { denaliTemplateSelectorPlugin } from "@/features/tours/wizard/denali/plugins/DenaliTemplateSelectorPlugin";
import { denaliWizardClearAllPlugin } from "@/features/tours/wizard/denali/plugins/DenaliWizardClearAllPlugin";
import {
  orchestrateDenaliWizardFromTemplate,
  emptyDenaliWizardCanonicalData,
} from "@/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate";
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
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { TourWizardTemplateInstantiateResponse } from "@/features/tours/wizard/hooks/useInstantiateWorkspaceTemplate";
import { appendDraftEngineTrace } from "@/lib/draft-engine-trace";
import { createDenaliDraftAdapter } from "@/features/tours/drafts/denali-adapter";
import { isWizardFormCanonicalEmpty } from "@/features/tours/wizard/validation/wizardCanonicalSubmitGuard";

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

function extractFactoryWizardForm(
  response: TourWizardTemplateInstantiateResponse,
): DenaliCreateTourWizardForm | null {
  if (!response.success) {
    return null;
  }
  const factoryForm = response.draftState.data.form;
  if (factoryForm == null || typeof factoryForm !== "object") {
    return null;
  }
  return factoryForm as DenaliCreateTourWizardForm;
}

function mergeFactoryWithDraftBaseline(
  factoryForm: DenaliCreateTourWizardForm,
  draftForm: Partial<DenaliCreateTourWizardForm> | undefined,
  ruleSet: DenaliRuleSet,
): DenaliCreateTourWizardForm {
  const factoryBaseline = finalizeDenaliWizardHydration(factoryForm, ruleSet);
  if (draftForm == null) {
    return factoryBaseline;
  }
  return finalizeDenaliWizardHydration(
    mergeDenaliFormDefaults(factoryBaseline, draftForm),
    ruleSet,
  );
}

function assertFactoryHydrationParity(
  factoryForm: DenaliCreateTourWizardForm,
  mergedForm: DenaliCreateTourWizardForm,
  draftForm: Partial<DenaliCreateTourWizardForm> | undefined,
  ruleSet: DenaliRuleSet,
  context: { workspaceId?: string | null },
): void {
  const expected = mergeFactoryWithDraftBaseline(factoryForm, draftForm, ruleSet);
  if (JSON.stringify(expected) === JSON.stringify(mergedForm)) {
    return;
  }

  const message = `[${DenaliProductionErrorCode.FACTORY_HYDRATION_PARITY_MISMATCH}] Factory hydration parity mismatch`;
  LoggerService.error(message, {
    code: DenaliProductionErrorCode.FACTORY_HYDRATION_PARITY_MISMATCH,
    layer: "denali_factory_hydration",
    workspaceId: context.workspaceId ?? undefined,
    hasDraftForm: draftForm != null,
  });
  throw new HydrationParityError(message);
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
  const [stepBusy, setStepBusy] = useState(false);
  const [formHydrationApplied, setFormHydrationApplied] = useState(false);

  const isHydratingDraftRef = useRef(false);
  const initialHydrateDoneRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const stagingTourIdRef = useRef<string | null>(null);
  const abandonStagingShellRef = useRef<(() => void) | null>(null);
  const previousWorkspaceIdRef = useRef<string | null>(null);

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
        getRuleSet: () => ruleSet,
      }),
    [ruleSet, workspaceId],
  );

  const {
    state: draftState,
    setDraftData,
    retry: retryDraft,
    initialize: initializeDraft,
    clearDraft,
  } = useDraftEngine(draftConfig);

  const instantiateTemplateQuery = useInstantiateWorkspaceTemplate(
    Boolean(workspaceId && pinnedTemplate),
  );

  const setDraftDataRef = useRef(setDraftData);
  setDraftDataRef.current = setDraftData;
  const draftStatusRef = useRef(draftState.status);
  draftStatusRef.current = draftState.status;
  const prevDraftStatusRef = useRef(draftState.status);

  const factoryWizardForm = useMemo((): DenaliCreateTourWizardForm | null => {
    if (!instantiateTemplateQuery.isSuccess) {
      return null;
    }
    return extractFactoryWizardForm(instantiateTemplateQuery.data);
  }, [instantiateTemplateQuery.data, instantiateTemplateQuery.isSuccess]);

  const factoryInstantiateSettled = instantiateTemplateQuery.isFetched;
  const factoryHydrationRejected =
    factoryInstantiateSettled &&
    (instantiateTemplateQuery.isError ||
      (instantiateTemplateQuery.isSuccess &&
        (factoryWizardForm == null || !instantiateTemplateQuery.data.success)));

  const factoryHydrationErrors = useMemo((): readonly string[] => {
    if (instantiateTemplateQuery.isError && instantiateTemplateQuery.error instanceof ApiError) {
      const errorBody = instantiateTemplateQuery.error.data as {
        error?: {
          code?: string;
          message?: string;
          details?: { errors?: unknown; correlationId?: string };
        };
      };
      const apiCode = errorBody.error?.code;
      const apiMessage = errorBody.error?.message;
      if (apiCode === "TEMPLATE_CANONICAL_EMPTY" && apiMessage) {
        return [apiMessage];
      }
      const details = errorBody.error?.details?.errors;
      if (Array.isArray(details)) {
        const orchestrationErrors = details.filter(
          (entry): entry is string => typeof entry === "string",
        );
        if (orchestrationErrors.length > 0) {
          return orchestrationErrors;
        }
      }
      const status = instantiateTemplateQuery.error.status;
      const correlationId = errorBody.error?.details?.correlationId;
      const prefix = [apiCode, status != null ? `HTTP ${status}` : null, correlationId]
        .filter((part): part is string | number => part != null && part !== "")
        .join(" · ");
      const fallbackMessage = instantiateTemplateQuery.error.message || "Request failed.";
      return [prefix ? `${prefix}: ${fallbackMessage}` : fallbackMessage];
    }
    if (instantiateTemplateQuery.isSuccess && !instantiateTemplateQuery.data.success) {
      return instantiateTemplateQuery.data.errors ?? ["Template orchestration failed."];
    }
    if (instantiateTemplateQuery.isSuccess && factoryWizardForm == null) {
      return ["Template factory returned no hydratable wizard form."];
    }
    return [];
  }, [
    factoryWizardForm,
    instantiateTemplateQuery.data,
    instantiateTemplateQuery.error,
    instantiateTemplateQuery.isError,
    instantiateTemplateQuery.isSuccess,
  ]);

  const computeMergedWizardForm = useCallback((): DenaliCreateTourWizardForm | null => {
    if (factoryWizardForm == null) {
      return null;
    }
    const draftForm = draftState.data?.form as Partial<DenaliCreateTourWizardForm> | undefined;
    const merged = mergeFactoryWithDraftBaseline(factoryWizardForm, draftForm, ruleSet);
    assertFactoryHydrationParity(factoryWizardForm, merged, draftForm, ruleSet, {
      workspaceId,
    });
    return merged;
  }, [draftState.data?.form, factoryWizardForm, ruleSet, workspaceId]);

  useEffect(() => {
    if (!factoryHydrationRejected) {
      return;
    }
    reportDenaliDraftError(resolvedRailId, "initialize", new Error("TEMPLATE_REJECTED"), {
      workspaceId: workspaceId ?? null,
      wizardTemplateReady: Boolean(pinnedTemplate),
      factoryHydrationErrors,
    });
  }, [
    factoryHydrationErrors,
    factoryHydrationRejected,
    pinnedTemplate,
    resolvedRailId,
    workspaceId,
  ]);

  const templateHydrationReady =
    draftInitComplete &&
    factoryInstantiateSettled &&
    !instantiateTemplateQuery.isFetching &&
    !factoryHydrationRejected &&
    factoryWizardForm != null;

  const wizardFormReady = templateHydrationReady && formHydrationApplied;

  const formMethods = useForm<DenaliCreateTourWizardForm>({
    defaultValues,
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

  const reportOrchestrationError = useCallback(
    (errors: readonly string[]) => {
      const message = errors[0] ?? t("wizard.templateRejected");
      setError("root", { type: "manual", message });
    },
    [setError, t],
  );

  const resetToEmptyForm = useCallback(async () => {
    await withDraftHydrationAsync(async () => {
      const result = await orchestrateDenaliWizardFromTemplate(
        pinnedTemplate,
        pinnedTemplate.canonicalData as Record<string, unknown>,
      );
      if (!result.success) {
        reportOrchestrationError(result.errors);
        return;
      }
      revokeBlobUrlsFromDenaliForm(getValues());
      reset(result.form, DENALI_QUIET_FORM_RESET_OPTIONS);
      setCurrentStep(0);
      setCanonicalSyncToken((token) => token + 1);
    });
  }, [getValues, pinnedTemplate, reportOrchestrationError, reset, withDraftHydrationAsync]);

  const handleClearAll = useCallback(async () => {
    await withDraftHydrationAsync(async () => {
      const result = await orchestrateDenaliWizardFromTemplate(
        pinnedTemplate,
        emptyDenaliWizardCanonicalData(),
      );
      if (!result.success) {
        reportOrchestrationError(result.errors);
        return;
      }
      abandonStagingShellRef.current?.();
      revokeBlobUrlsFromDenaliForm(getValues());
      reset(result.form, DENALI_QUIET_FORM_RESET_OPTIONS);
      setCurrentStep(0);
      setCanonicalSyncToken((token) => token + 1);
      await clearDraft();
    });
  }, [clearDraft, getValues, pinnedTemplate, reportOrchestrationError, reset, withDraftHydrationAsync]);

  useEffect(() => {
    setFormHydrationApplied(false);
    initialHydrateDoneRef.current = false;
  }, [pinnedTemplate.id, workspaceId]);

  useLayoutEffect(() => {
    const nextWorkspace = workspaceId?.trim() || null;
    const previousWorkspace = previousWorkspaceIdRef.current;

    if (
      previousWorkspace != null &&
      nextWorkspace != null &&
      previousWorkspace !== nextWorkspace
    ) {
      stagingTourIdRef.current = null;
      abandonStagingShellRef.current?.();
      revokeBlobUrlsFromDenaliForm(getValues());
      reset(buildDenaliTourCreateDefaultValues(), DENALI_QUIET_FORM_RESET_OPTIONS);
      setCurrentStep(0);
      setCanonicalSyncToken((token) => token + 1);
      setFormHydrationApplied(false);
      initialHydrateDoneRef.current = false;
    }

    previousWorkspaceIdRef.current = nextWorkspace;
  }, [getValues, reset, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !pinnedTemplate) {
      setDraftInitComplete(false);
      initialHydrateDoneRef.current = false;
      setFormHydrationApplied(false);
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
  }, [initializeDraft, pinnedTemplate, resolvedRailId, workspaceId]);

  useEffect(() => {
    if (!pinnedTemplate || !templateHydrationReady || initialHydrateDoneRef.current) {
      return;
    }

    const mergedForm = computeMergedWizardForm();
    if (mergedForm == null) {
      return;
    }
    withDraftHydration(() => {
      const stepFromDraft = draftState.data?.currentStepIndex ?? 0;
      reset(mergedForm, DENALI_QUIET_FORM_RESET_OPTIONS);
      setCurrentStep(stepFromDraft);
      setCanonicalSyncToken((token) => token + 1);
      initialHydrateDoneRef.current = true;
      setFormHydrationApplied(true);
    });
  }, [
    computeMergedWizardForm,
    draftState.data?.currentStepIndex,
    draftState.data?.form,
    draftState.status,
    pinnedTemplate,
    reset,
    ruleSet,
    templateHydrationReady,
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

    const mergedForm = computeMergedWizardForm();
    if (mergedForm == null) {
      return;
    }

    const mergedDraft = draftState.data;
    setStaleDraftNoticeOpen(true);
    withDraftHydration(() => {
      const stepFromDraft = mergedDraft.currentStepIndex ?? 0;
      reset(mergedForm, DENALI_QUIET_FORM_RESET_OPTIONS);
      setCurrentStep(stepFromDraft);
      setCanonicalSyncToken((token) => token + 1);
      setFormHydrationApplied(true);
    });
  }, [
    computeMergedWizardForm,
    draftInitComplete,
    draftState.data,
    draftState.status,
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
    appendDraftEngineTrace("wizard_set_draft_user", "pushDraftUserEditRef", {
      currentStepIndex: currentStepRef.current,
      draftStatus: draftStatusRef.current,
    });
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
    appendDraftEngineTrace("wizard_set_draft_step", "currentStep effect → setDraftData", {
      currentStep,
      draftStatus: draftStatusRef.current,
    });
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
    if (!wizardFormReady) {
      return [] as readonly DenaliCreateWizardStepId[];
    }
    return resolveVisibleSteps(shellLayout, getValues(), ruleSet) as readonly DenaliCreateWizardStepId[];
  // `getValues` is stable; `_tourTypeWatch` recomputes visible steps when tour kind changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tour kind watch invalidates memo
  }, [_tourTypeWatch, getValues, ruleSet, shellLayout, wizardFormReady]);

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

  const handleRetryDraft = useCallback(() => {
    void retryDraft();
  }, [retryDraft]);

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

      if (isWizardFormCanonicalEmpty(values)) {
        setError("root", {
          type: "manual",
          message: t("wizard.templateCanonicalEmptyOnSubmit"),
        });
        return;
      }

      const destinationIds = new Set(destinationsQuery.destinations.map((d) => d.id));
      const themeIds = new Set((themesQuery.data ?? []).map((d) => d.id));
      const prepareOptions = {
        ruleSet,
        workspaceId,
        catalog: { destinationIds, themeIds },
      };
      const submitArtifact = prepareDenaliSubmitArtifact(values, prepareOptions);

      const gate = evaluateDenaliWizardSubmitGate(submitArtifact, {
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
        focusFirstSubmitError(submitArtifact, gate.submitIssues, gate.publishIssues);
        return;
      }

      await createMutation.mutateAsync({
        submitArtifact,
        workspaceFormProfile,
        themeCatalog: themesQuery.data?.map((theme) => ({ id: theme.id, name: theme.name })),
        stagingTourId: stagingTourIdRef.current ?? undefined,
      });
      await clearDraft();
      abandonStagingShellRef.current?.();
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

  const wizardHydrationLoading =
    Boolean(workspaceId && pinnedTemplate) &&
    !wizardFormReady &&
    (!factoryInstantiateSettled || instantiateTemplateQuery.isFetching);

  if (wizardHydrationLoading) {
    return (
      <Card data-testid="workspace-tour-wizard-factory-loading">
        <CardBody>
          <p role="status">{t("wizard.loading")}</p>
        </CardBody>
      </Card>
    );
  }

  if (factoryHydrationRejected) {
    return (
      <Card data-testid="workspace-tour-wizard-factory-rejected">
        <CardBody>
          <div
            role="alert"
            data-testid="workspace-wizard-template-rejected-banner"
            className={cn(alertStyles.alertBanner, alertStyles.alertBannerDanger)}
          >
            <p style={{ margin: 0 }}>{t("wizard.templateRejected")}</p>
            {factoryHydrationErrors.length > 0 ? (
              <ul style={{ margin: "0.75rem 0 0", paddingInlineStart: "1.25rem" }}>
                {factoryHydrationErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </CardBody>
      </Card>
    );
  }

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
        abandonStagingShellRef={abandonStagingShellRef}
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
                    wizardTemplate: pinnedTemplate,
                    workspaceFormProfile: workspaceFormProfile ?? undefined,
                    onCanonicalSync: () => setCanonicalSyncToken((token) => token + 1),
                    onClearForm: resetToEmptyForm,
                    onClearAll: handleClearAll,
                    onOrchestrationError: reportOrchestrationError,
                  }}
                />
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
