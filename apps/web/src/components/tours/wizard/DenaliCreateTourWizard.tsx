"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Button, Card, CardBody } from "@tour/ui";

import { formatWizardApiErrorMessage } from "@/features/tours/wizard/format-wizard-api-error";
import { scrollTourFormToFirstError } from "@/components/tours/tourFormValidationSummary";
import { ApiError } from "@/lib/api-client";
import { handleDenaliWizardValidationApiError } from "@/lib/errors/apply-api-validation-errors";
import { DenaliTourCreationPresetBanner } from "@/features/tours/wizard/DenaliTourCreationPresetBanner";
import { useDenaliTourWizardCreate } from "@/features/tours/wizard/hooks/useDenaliTourWizardCreate";
import { useTourWizardServerSync } from "@/features/tours/wizard/hooks/useTourWizardServerSync";
import { isDenaliDraftEnabled } from "@/features/tours/wizard/is-denali-draft-enabled";
import { isTourWizardServerDraftEnabled } from "@/features/tours/wizard/is-tour-wizard-server-draft-enabled";
import { useSettingsTourPresets } from "@/hooks/use-settings-tour-presets";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import { isWizardSubmitLocked } from "@/features/tours/wizard/wizardSubmitLock";
import { clearWizardSubmitIdempotencyKey } from "@/features/tours/wizard/wizardSubmitSession";
import { useTenantContext } from "@/lib/tenant/tenant-provider";
import { deleteTourWizardDraft, fetchTourWizardDraft, TOUR_WIZARD_DRAFT_INITIAL_VERSION } from "@/lib/tour-wizard-draft.client";
import {
  getDenaliStepTitleFa,
  type DenaliCreateWizardStepId,
} from "@/features/tours/wizard/denaliStepConfig";
import {
  DenaliBasicInfoStep,
  DenaliPricingPaymentStep,
  DenaliProgramNatureStep,
  DenaliReviewStep,
  DenaliLogisticsStep,
  DenaliPhotosStep,
} from "@/features/tours/wizard/denali";
import { sanitizeDenaliWizardCatalogRefs } from "@/features/tours/wizard/denali/sanitizeDenaliWizardCatalogRefs";
import { preserveDenaliWizardBlobMedia } from "@/features/tours/wizard/denali/preserveDenaliWizardBlobMedia";
import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import {
  getDenaliWizardVisibleSteps,
  prepareDenaliWizardFormForSubmit,
  resolveDenaliRuleSetFromTemplate,
  withDenaliWizardRailTestingOverrides,
} from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import { getDenaliWizardPublishReadinessIssues } from "@/features/tours/wizard/denali/validation/denaliWizardPublishReadiness";
import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import {
  collectDenaliUnpersistedPhotoBlobIssues,
  formatDenaliPhotoPersistenceWarning,
} from "@/features/tours/wizard/denali/denaliPhotoPersistence";
import { DenaliWizardSyncProvider } from "@/features/tours/wizard/denali/DenaliWizardSyncContext";
import { DenaliWizardNavigationProvider } from "@/features/tours/wizard/denali/DenaliWizardNavigationContext";
import { DenaliStepFocusBridge } from "@/features/tours/wizard/denali/DenaliStepFocusBridge";
import { DenaliWizardSubmitControl } from "@/features/tours/wizard/denali/DenaliWizardSubmitControl";
import {
  isDenaliCloneOrPresetPrefill,
  readDenaliPrefillFromLocalStorage,
} from "@/features/tours/wizard/denali/bootstrapDenaliPrefillDraft";
import { mergeDenaliWizardDefaults, type ParsedDenaliWizardDraft } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import { tryHydrateCanonicalTemplate } from "@/features/tours/wizard/denali/canonicalTemplateHydration";
import type { DenaliCanonicalTemplateData } from "@repo/types/denali";
import {
  clearDenaliWizardDraftFromStorage,
  saveDraft,
} from "@/features/tours/wizard/denali/denaliWizardDraftSave";
import {
  readDenaliCreateWizardDraftFromStorage,
  readDenaliWizardDraftFromStorage,
  resolveDenaliWizardDraftHydration,
  tryHydrateDraft,
  tryMigrateDenaliWizardDraft,
} from "@/features/tours/wizard/denali/safeDraftHydration";
import { pickDenaliWizardDraftForRestore } from "@/features/tours/wizard/denali/pickDenaliWizardDraftForRestore";
import { DenaliWizardDraftAutosave } from "@/features/tours/wizard/denali/DenaliWizardDraftAutosave";
import { DenaliWizardContentQualityHeader } from "@/features/tours/wizard/denali/components/DenaliWizardHeader";
import { useDenaliCreateWizardDraftStorageKey } from "@/features/tours/wizard/denali/useDenaliCreateWizardDraftStorageKey";
import {
  resolveWizardDraftStorageKeyForBrowserHost,
  purgeAllWizardDraftLocalStorageKeys,
} from "@/features/tours/wizard/tourWizardDraftEnvelope";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { createDenaliCanonicalWizardResolver } from "@/features/tours/wizard/schemas/denaliWizardCanonicalResolver";
import { applyDenaliWizardStepValidation } from "@/features/tours/wizard/schemas/denaliTourCreateValidation";
import { debugSessionLog } from "@/lib/debug-session-log";
import { useAuth } from "@/lib/auth/auth-context";
import { QuickAddModalProvider } from "@/components/shared/QuickAddModal";
import { serializeDenaliWizardDraft } from "@/features/tours/wizard/denaliWizardDraftEnvelope";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isWorkspaceUuid(scope: string | null): scope is string {
  return scope != null && UUID_RE.test(scope.trim());
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
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        listStyle: "none",
        padding: 0,
        margin: 0,
      }}
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
  let body: ReactNode;
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
      body = <DenaliPricingPaymentStep />;
      break;
    case "denali_photos":
      body = <DenaliPhotosStep />;
      break;
    case "review":
      body = <DenaliReviewStep />;
      break;
    default:
      body = null;
  }

  return (
    <>
      <DenaliStepFocusBridge stepId={stepId} />
      {body}
    </>
  );
}

function isAuthenticatedCloneOrPresetPrefill(
  localPrefill: NonNullable<ReturnType<typeof readDenaliPrefillFromLocalStorage>>,
): boolean {
  if (!localPrefill.formPatch || !isDenaliCloneOrPresetPrefill(localPrefill.wizardMeta)) {
    return false;
  }
  const meta = localPrefill.wizardMeta;
  return Boolean(meta?.sourceTourId?.trim() || meta?.sourcePresetId?.trim());
}

async function purgeDenaliWizardDraftStorage(
  workspaceId: string,
  draftStorageKey: string,
): Promise<void> {
  await deleteTourWizardDraft(workspaceId).catch(() => {});
  try {
    purgeAllWizardDraftLocalStorageKeys(
      resolveWizardDraftStorageKeyForBrowserHost(draftStorageKey),
    );
  } catch {
    /* ignore */
  }
}

export function DenaliCreateTourWizard() {
  const t = useTranslations("tours.new");
  const tDenali = useTranslations("tours.denali");
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenant = useTenantContext();
  const workspaceId = useWorkspaceQueryScope();
  const { user, isHydrated } = useAuth();
  const themesQuery = useSettingsTourThemes();
  const destinationsQuery = useTourDestinations();
  const presetsQuery = useSettingsTourPresets();
  const wizardTemplateQuery = useTenantWizardTemplate();
  const createMutation = useDenaliTourWizardCreate();
  const submitLocked = isWizardSubmitLocked(createMutation);
  const workspaceFormProfile = resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data);
  const [currentStep, setCurrentStep] = useState(0);
  const lastStepKeyRef = useRef<DenaliCreateWizardStepId | null>(null);
  const [canonicalSyncToken, setCanonicalSyncToken] = useState(0);
  const [wizardReady, setWizardReady] = useState(false);
  const [showIncompatibleDraftBanner, setShowIncompatibleDraftBanner] = useState(false);
  const [serverSyncEnabled, setServerSyncEnabled] = useState(false);
  const draftVersionRef = useRef(TOUR_WIZARD_DRAFT_INITIAL_VERSION);

  const defaultValues = useMemo(() => buildDenaliTourCreateDefaultValues(), []);

  const mergedRuleSet = useMemo(
    () => resolveDenaliRuleSetFromTemplate(wizardTemplateQuery.data),
    [wizardTemplateQuery.data],
  );
  const ruleSetRef = useRef(mergedRuleSet);
  ruleSetRef.current = mergedRuleSet;

  const resolver = useMemo(
    () => createDenaliCanonicalWizardResolver(undefined, () => ruleSetRef.current),
    [],
  );

  const formMethods = useForm<DenaliCreateTourWizardForm>({
    resolver,
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues,
  });

  const { getValues, setError, clearErrors, reset, control } = formMethods;
  const tourTypeWatch = useWatch({ control, name: "basicInfo.tourType" });
  const visibleSteps = useMemo(() => {
    const form = getValues();
    const rawSteps = getDenaliWizardVisibleSteps(form, mergedRuleSet);
    return withDenaliWizardRailTestingOverrides(rawSteps);
  }, [tourTypeWatch, canonicalSyncToken, mergedRuleSet, getValues]);
  const { draftStorageKey, legacyDraftStorageKey } = useDenaliCreateWizardDraftStorageKey(
    wizardTemplateQuery.data?.id,
  );
  const activeDraftStorageKey = draftStorageKey ?? legacyDraftStorageKey;
  const hydrateStartedRef = useRef(false);
  const pendingIncompatibleDraftRef = useRef<ParsedDenaliWizardDraft | null>(null);
  const draftWizardMetaRef = useRef<
    import("@/features/tours/wizard/tourWizardProfileResolve").TourWizardDraftMeta | undefined
  >(undefined);

  const serverSync = useTourWizardServerSync({
    workspaceId:
      isTourWizardServerDraftEnabled() && isWorkspaceUuid(workspaceId) ? workspaceId : null,
    form: formMethods,
    currentStepIndex: currentStep,
    wizardMetaRef: draftWizardMetaRef,
    enabled:
      wizardReady &&
      serverSyncEnabled &&
      !submitLocked &&
      !showIncompatibleDraftBanner &&
      isTourWizardServerDraftEnabled(),
    draftVersionRef,
  });

  const navLocked = submitLocked;

  const quickAddWizardPersistence = useMemo(
    () =>
      isDenaliDraftEnabled()
        ? {
            storageKey: activeDraftStorageKey,
            getFormValues: () => getValues() as Record<string, unknown>,
            serializeDraft: (values: Record<string, unknown>) =>
              serializeDenaliWizardDraft(
                values as Partial<DenaliCreateTourWizardForm>,
                draftWizardMetaRef.current,
              ),
          }
        : undefined,
    [activeDraftStorageKey, getValues],
  );

  const readStoredCreateDraft = useCallback(() => {
    if (draftStorageKey) {
      return readDenaliCreateWizardDraftFromStorage(draftStorageKey, legacyDraftStorageKey);
    }
    return readDenaliWizardDraftFromStorage(legacyDraftStorageKey);
  }, [draftStorageKey, legacyDraftStorageKey]);

  const clearStoredCreateDrafts = useCallback(() => {
    clearDenaliWizardDraftFromStorage(activeDraftStorageKey);
    if (legacyDraftStorageKey !== activeDraftStorageKey) {
      clearDenaliWizardDraftFromStorage(legacyDraftStorageKey);
    }
  }, [activeDraftStorageKey, legacyDraftStorageKey]);

  const handlePresetApplied = useCallback(
    (presetId: string) => {
      draftWizardMetaRef.current = {
        sourcePresetId: presetId,
        resolvedFormProfile: workspaceFormProfile,
        formProfileVersion: TOUR_FORM_PROFILE_VERSION,
      };
      setCanonicalSyncToken((token) => token + 1);
    },
    [workspaceFormProfile],
  );

  const applyHydratedDraftToForm = useCallback(
    (hydrated: NonNullable<ReturnType<typeof tryHydrateDraft>>) => {
      if (hydrated.wizardMeta) {
        draftWizardMetaRef.current = {
          ...hydrated.wizardMeta,
          resolvedFormProfile: workspaceFormProfile,
          formProfileVersion:
            hydrated.wizardMeta.formProfileVersion ?? TOUR_FORM_PROFILE_VERSION,
        };
      } else {
        draftWizardMetaRef.current = {
          resolvedFormProfile: workspaceFormProfile,
          formProfileVersion: TOUR_FORM_PROFILE_VERSION,
        };
      }
      reset(hydrated.formValues);
      setCanonicalSyncToken((token) => token + 1);
    },
    [reset, workspaceFormProfile],
  );

  const applyRestoredStepIndex = useCallback(
    (stepIndex: number | undefined) => {
      if (stepIndex == null || stepIndex <= 0) {
        return;
      }
      const steps = getDenaliWizardVisibleSteps(getValues(), mergedRuleSet);
      if (steps.length === 0) {
        return;
      }
      setCurrentStep(Math.min(stepIndex, steps.length - 1));
    },
    [getValues, mergedRuleSet],
  );

  const finishWizardHydrate = useCallback(
    (options?: { restoredStepIndex?: number }) => {
      applyRestoredStepIndex(options?.restoredStepIndex);
      setWizardReady(true);
      if (isTourWizardServerDraftEnabled()) {
        setServerSyncEnabled(true);
      }
    },
    [applyRestoredStepIndex],
  );

  useEffect(() => {
    if (!wizardReady || !serverSyncEnabled || !isTourWizardServerDraftEnabled()) {
      return;
    }
    serverSync.seedLastSyncedFingerprint();
  }, [wizardReady, serverSyncEnabled, serverSync.seedLastSyncedFingerprint]);

  const clearDraft = useCallback(() => {
    pendingIncompatibleDraftRef.current = null;
    setShowIncompatibleDraftBanner(false);
    clearStoredCreateDrafts();
    if (isWorkspaceUuid(workspaceId)) {
      void deleteTourWizardDraft(workspaceId).catch(() => {});
    }
    reset(defaultValues);
    setCurrentStep(0);
    setCanonicalSyncToken((token) => token + 1);
  }, [defaultValues, clearStoredCreateDrafts, reset, workspaceId]);

  const handleMigrateDraft = useCallback(() => {
    const draft =
      pendingIncompatibleDraftRef.current ?? readStoredCreateDraft();
    const hydrated = tryMigrateDenaliWizardDraft(draft, defaultValues, { ruleSet: mergedRuleSet });
    if (!hydrated) {
      clearDraft();
      return;
    }
    applyHydratedDraftToForm(hydrated);
    pendingIncompatibleDraftRef.current = null;
    setShowIncompatibleDraftBanner(false);
    saveDraft(
      activeDraftStorageKey,
      hydrated.formValues,
      draftWizardMetaRef.current,
      { ruleSet: mergedRuleSet },
    );
  }, [
    activeDraftStorageKey,
    applyHydratedDraftToForm,
    clearDraft,
    defaultValues,
    mergedRuleSet,
    readStoredCreateDraft,
  ]);

  useEffect(() => {
    if (hydrateStartedRef.current) {
      return;
    }
    const template = wizardTemplateQuery.data;
    if (!template) {
      return;
    }
    if (isTourWizardServerDraftEnabled() && !isHydrated) {
      return;
    }
    hydrateStartedRef.current = true;

    if (!isWorkspaceUuid(workspaceId)) {
      finishWizardHydrate();
      return;
    }

    void (async () => {
      if (searchParams.get("new") === "true") {
        clearStoredCreateDrafts();
        await purgeDenaliWizardDraftStorage(workspaceId, activeDraftStorageKey);
        pendingIncompatibleDraftRef.current = null;
        setShowIncompatibleDraftBanner(false);
        reset(defaultValues);
        setCurrentStep(0);
        setCanonicalSyncToken((token) => token + 1);
        finishWizardHydrate();
        return;
      }

      let localPrefill = readStoredCreateDraft();
      let restoredStepIndex: number | undefined;

      if (
        isTourWizardServerDraftEnabled() &&
        isWorkspaceUuid(workspaceId) &&
        user?.userId
      ) {
        try {
          const { draft: serverDraft } = await fetchTourWizardDraft(workspaceId);
          const pick = pickDenaliWizardDraftForRestore(localPrefill, serverDraft);
          if (pick) {
            if (pick.serverVersion != null) {
              draftVersionRef.current = pick.serverVersion;
            }
            restoredStepIndex = pick.currentStepIndex;
            if (pick.source === "server") {
              localPrefill = pick.parsed;
              draftWizardMetaRef.current = {
                ...pick.parsed.wizardMeta,
                savedAt: serverDraft?.updatedAt ?? pick.parsed.wizardMeta?.savedAt,
                resolvedFormProfile: workspaceFormProfile,
                formProfileVersion: TOUR_FORM_PROFILE_VERSION,
              };
            }
          }
        } catch {
          /* local draft remains source of truth */
        }
      }

      const mayApplyCloneOrPreset =
        localPrefill != null && isAuthenticatedCloneOrPresetPrefill(localPrefill);

      if (mayApplyCloneOrPreset && localPrefill?.formPatch) {
        clearStoredCreateDrafts();
        const formValues = prepareDenaliWizardFormForSubmit(
          mergeDenaliWizardDefaults(defaultValues, localPrefill.formPatch, mergedRuleSet),
          mergedRuleSet,
        );
        applyHydratedDraftToForm({ formValues, wizardMeta: localPrefill.wizardMeta });
        saveDraft(
          activeDraftStorageKey,
          formValues,
          draftWizardMetaRef.current,
          { ruleSet: mergedRuleSet },
        );
        pendingIncompatibleDraftRef.current = null;
        setShowIncompatibleDraftBanner(false);
        finishWizardHydrate({ restoredStepIndex });
        return;
      }

      const draftResolution = resolveDenaliWizardDraftHydration(localPrefill);
      if (draftResolution.status === "compatible") {
        const hydrated = tryHydrateDraft(draftResolution.draft, defaultValues, {
          ruleSet: mergedRuleSet,
        });
        if (hydrated) {
          applyHydratedDraftToForm(hydrated);
          saveDraft(
            activeDraftStorageKey,
            hydrated.formValues,
            draftWizardMetaRef.current,
            { ruleSet: mergedRuleSet },
          );
          pendingIncompatibleDraftRef.current = null;
          setShowIncompatibleDraftBanner(false);
          finishWizardHydrate({ restoredStepIndex });
          return;
        }
      }

      if (draftResolution.status === "incompatible") {
        pendingIncompatibleDraftRef.current = draftResolution.draft;
        setShowIncompatibleDraftBanner(true);
        reset(defaultValues);
        setCurrentStep(0);
        setCanonicalSyncToken((token) => token + 1);
        finishWizardHydrate();
        return;
      }

      pendingIncompatibleDraftRef.current = null;
      setShowIncompatibleDraftBanner(false);

      const templateCanonical = wizardTemplateQuery.data?.canonicalData;
      if (
        templateCanonical != null &&
        typeof templateCanonical === "object" &&
        Object.keys(templateCanonical).length > 0
      ) {
        const hydrated = tryHydrateCanonicalTemplate(
          templateCanonical as DenaliCanonicalTemplateData,
          defaultValues,
          undefined,
          mergedRuleSet,
        );
        if (hydrated) {
          applyHydratedDraftToForm(hydrated);
          finishWizardHydrate({ restoredStepIndex });
          return;
        }
      }

      reset(defaultValues);
      setCurrentStep(0);
      setCanonicalSyncToken((token) => token + 1);
      finishWizardHydrate({ restoredStepIndex });
    })();
  }, [
    activeDraftStorageKey,
    applyHydratedDraftToForm,
    clearStoredCreateDrafts,
    defaultValues,
    finishWizardHydrate,
    isHydrated,
    mergedRuleSet,
    readStoredCreateDraft,
    reset,
    searchParams,
    user?.userId,
    wizardTemplateQuery.data,
    workspaceFormProfile,
    workspaceId,
  ]);

  const catalogSanitizedRef = useRef(false);
  useLayoutEffect(() => {
    if (!wizardReady || catalogSanitizedRef.current) {
      return;
    }
    if (destinationsQuery.isLoading || themesQuery.isLoading) {
      return;
    }
    if (!destinationsQuery.groupedRegions || !themesQuery.data) {
      return;
    }
    const destinationIds = new Set(
      destinationsQuery.groupedRegions.flatMap((g) => g.items.map((d) => d.id)),
    );
    const themeIds = new Set(
      (themesQuery.data ?? []).filter((theme) => theme.isActive).map((theme) => theme.id),
    );
    const current = getValues();
    const { form: sanitized, clearedDestination, clearedThemeIds } = sanitizeDenaliWizardCatalogRefs(
      current,
      { destinationIds, themeIds },
    );
    if (!clearedDestination && clearedThemeIds === 0) {
      catalogSanitizedRef.current = true;
      return;
    }
    catalogSanitizedRef.current = true;
    const next = applyDenaliInvariantState(sanitized, undefined, mergedRuleSet);
    reset(next, { keepDefaultValues: true });
    setCanonicalSyncToken((token) => token + 1);
  }, [destinationsQuery.groupedRegions, getValues, mergedRuleSet, reset, themesQuery.data, wizardReady]);

  useEffect(() => {
    const key = visibleSteps[currentStep];
    if (key) {
      lastStepKeyRef.current = key;
    }
  }, [currentStep, visibleSteps]);

  useEffect(() => {
    const prevKey = lastStepKeyRef.current;
    if (!prevKey || visibleSteps.length === 0) {
      return;
    }
    const nextIndex = visibleSteps.indexOf(prevKey);
    if (nextIndex === -1) {
      setCurrentStep((prev) => Math.min(prev, visibleSteps.length - 1));
      return;
    }
    setCurrentStep((prev) => (prev === nextIndex ? prev : nextIndex));
  }, [visibleSteps]);

  const currentStepKey = visibleSteps[currentStep]!;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === visibleSteps.length - 1;

  const formForPublishGate = useWatch({
    control: formMethods.control,
    disabled: currentStepKey !== "review",
  });
  const openPublishBlocked = useMemo(() => {
    if (currentStepKey !== "review" || formForPublishGate == null) {
      return false;
    }
    if (formForPublishGate.basicInfo?.publishStatus !== "active") {
      return false;
    }
    return (
      getDenaliWizardPublishReadinessIssues(
        formForPublishGate as DenaliCreateTourWizardForm,
        workspaceFormProfile,
        mergedRuleSet,
      ).length > 0
    );
  }, [currentStepKey, formForPublishGate, mergedRuleSet, workspaceFormProfile]);

  const handleNext = useCallback(async () => {
    const values = getValues();
    const normalized = applyDenaliInvariantState(values, undefined, mergedRuleSet);
    const withBlobs = preserveDenaliWizardBlobMedia(values, normalized);
    reset(withBlobs, { keepDefaultValues: true, keepDirty: true });
    setCanonicalSyncToken((token) => token + 1);

    const ok = applyDenaliWizardStepValidation(
      withBlobs,
      currentStepKey,
      setError,
      clearErrors,
      undefined,
      mergedRuleSet,
    );

    debugSessionLog(
      "DenaliCreateTourWizard.tsx:handleNext",
      "Step navigation validation",
      {
        step: currentStepKey,
        stepIndex: currentStep,
        validationPassed: ok,
        transportMode: withBlobs.transport?.transportMode,
        publishStatus: withBlobs.basicInfo?.publishStatus,
      },
      "D",
    );

    if (ok) {
      setCurrentStep((prev) => Math.min(prev + 1, visibleSteps.length - 1));
      window.scrollTo(0, 0);
    }
  }, [
    clearErrors,
    currentStepKey,
    getValues,
    mergedRuleSet,
    reset,
    setCanonicalSyncToken,
    setError,
    visibleSteps.length,
  ]);

  const onSubmit = useCallback(
    async (values: DenaliCreateTourWizardForm) => {
      const photoPersistenceIssues = collectDenaliUnpersistedPhotoBlobIssues(values);
      if (photoPersistenceIssues.length > 0) {
        setError("root", {
          type: "manual",
          message: formatDenaliPhotoPersistenceWarning(photoPersistenceIssues),
        });
        return;
      }
      const safeValues = prepareDenaliWizardFormForSubmit(values, mergedRuleSet);
      const publishIssues = getDenaliWizardPublishReadinessIssues(
        safeValues,
        workspaceFormProfile,
        mergedRuleSet,
      );
      debugSessionLog(
        "DenaliCreateTourWizard.tsx:onSubmit",
        "Final submit clicked",
        {
          publishStatus: safeValues.basicInfo.publishStatus,
          transportMode: safeValues.transport.transportMode,
          publishReadinessCount: publishIssues.length,
          publishReadinessSample: publishIssues.slice(0, 5).map((i) => i.message),
          tourKind: safeValues.basicInfo.tourType,
        },
        "C",
      );
      if (
        safeValues.basicInfo.publishStatus === "active" &&
        publishIssues.length > 0
      ) {
        setError("root", {
          type: "manual",
          message: tDenali("review.publishSubmitBlocked"),
        });
        return;
      }
      clearErrors("root");
      const themeCatalog = (themesQuery.data ?? [])
        .filter((row) => row.isActive)
        .map((row) => ({ id: row.id, name: row.name }));
      try {
        await createMutation.mutateAsync({
          values: safeValues,
          ruleSet: mergedRuleSet,
          workspaceFormProfile,
          themeCatalog,
          sourcePresetId: draftWizardMetaRef.current?.sourcePresetId,
          sourceTourId: draftWizardMetaRef.current?.sourceTourId,
        });
      } catch (err) {
        if (
          err instanceof ApiError &&
          handleDenaliWizardValidationApiError(err, setError, {
            clearErrors: () => clearErrors("root"),
            onApplied: (issues) => {
              scrollTourFormToFirstError(
                issues.map((issue) => ({
                  path: issue.path,
                  label: issue.path,
                  message: issue.message,
                })),
              );
            },
          })
        ) {
          createMutation.reset();
          return;
        }
        debugSessionLog(
          "DenaliCreateTourWizard.tsx:onSubmit",
          "Create mutation rejected",
          {
            errorMessage: err instanceof Error ? err.message : String(err),
          },
          "E",
        );
        if (err instanceof ApiError) {
          setError("root", {
            type: "server",
            message: formatWizardApiErrorMessage(err, t("mutationGenericFailed")),
          });
        }
        return;
      }
      clearWizardSubmitIdempotencyKey();
      if (isWorkspaceUuid(workspaceId)) {
        void purgeDenaliWizardDraftStorage(workspaceId, activeDraftStorageKey);
      }
      router.push("/tours");
      router.refresh();
    },
    [
      clearErrors,
      createMutation,
      activeDraftStorageKey,
      mergedRuleSet,
      router,
      setError,
      t,
      tDenali,
      themesQuery.data,
      workspaceFormProfile,
      workspaceId,
    ],
  );

  const submitErrorMessage = createMutation.error
    ? formatWizardApiErrorMessage(createMutation.error, t("mutationGenericFailed"))
    : null;

  if (!wizardReady) {
    return null;
  }

  return (
    <QuickAddModalProvider wizardPersistence={quickAddWizardPersistence}>
      <FormProvider {...formMethods}>
        {isDenaliDraftEnabled() ? (
          <DenaliWizardDraftAutosave
            enabled={wizardReady && !submitLocked}
            draftStorageKey={activeDraftStorageKey}
            formMethods={formMethods}
            draftWizardMetaRef={draftWizardMetaRef}
            ruleSet={mergedRuleSet}
            canonicalSyncToken={canonicalSyncToken}
            useBackupStorage={showIncompatibleDraftBanner}
          />
        ) : null}
        <DenaliCanonicalProvider
          formMethods={formMethods}
          syncToken={canonicalSyncToken}
          wizardTemplate={wizardTemplateQuery.data}
          workspaceFormProfile={workspaceFormProfile}
        >
          <DenaliWizardSyncProvider isSyncing={serverSync.isSyncing}>
          <DenaliWizardNavigationProvider
            visibleSteps={visibleSteps}
            currentStepIndex={currentStep}
            setCurrentStep={setCurrentStep}
          >
          <Card
            data-testid="denali-create-tour-wizard"
            data-denali-wizard-root="true"
            data-wizard-rail="denali"
            data-wizard-step-count={visibleSteps.length}
            data-resolved-form-profile={workspaceFormProfile}
            data-tenant-slug={tenant.tenantSlug}
            title={t("pageTitle")}
            description={t("cardDescription")}
          >
            <CardBody>
              <form
                onSubmit={(event) => event.preventDefault()}
                noValidate
                style={{ display: "grid", gap: "1rem" }}
              >
                {showIncompatibleDraftBanner ? (
                  <div
                    role="status"
                    style={{
                      display: "grid",
                      gap: "0.75rem",
                      padding: "1rem",
                      background: "var(--color-warning-50, #fffbeb)",
                      color: "var(--color-warning-900, #78350f)",
                      border: "1px solid var(--color-warning-200, #fde68a)",
                      borderRadius: "8px",
                    }}
                    data-testid="denali-draft-incompatible-banner"
                  >
                    <p style={{ margin: 0 }}>{tDenali("draftHydration.incompatibleBanner")}</p>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleMigrateDraft}
                        data-testid="denali-draft-migrate"
                      >
                        {tDenali("draftHydration.migrateDraft")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={clearDraft}
                        data-testid="denali-draft-reset-fresh"
                      >
                        {tDenali("draftHydration.resetAndStartFresh")}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <DenaliWizardContentQualityHeader />

                <DenaliWizardStepper steps={visibleSteps} currentIndex={currentStep} />

                {isFirstStep ? (
                  <DenaliTourCreationPresetBanner
                    presets={presetsQuery.data}
                    onApplied={handlePresetApplied}
                  />
                ) : null}

                <div style={{ padding: "0.25rem 0" }}>
                  <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                    گام {currentStep + 1} از {visibleSteps.length}:{" "}
                    {getDenaliStepTitleFa(currentStepKey)}
                  </h2>
                </div>

                <DenaliStepBody stepId={currentStepKey} />

                {isLastStep && formMethods.formState.errors.root?.message ? (
                  <p
                    role="alert"
                    style={{
                      margin: 0,
                      fontSize: "0.9rem",
                      color: "var(--color-danger-800, #991b1b)",
                    }}
                    data-testid="denali-wizard-publish-submit-blocked"
                  >
                    {formMethods.formState.errors.root.message}
                  </p>
                ) : null}

                {isLastStep && submitErrorMessage ? (
                  <p
                    role="alert"
                    style={{
                      margin: 0,
                      fontSize: "0.9rem",
                      color: "var(--color-danger-800, #991b1b)",
                    }}
                  >
                    {submitErrorMessage}
                  </p>
                ) : null}

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCurrentStep((p) => Math.max(p - 1, 0));
                      window.scrollTo(0, 0);
                    }}
                    disabled={isFirstStep || navLocked}
                  >
                    قبلی
                  </Button>
                  {!isLastStep ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void handleNext()}
                      disabled={navLocked}
                    >
                      بعدی
                    </Button>
                  ) : (
                    <DenaliWizardSubmitControl
                      disabled={navLocked || openPublishBlocked}
                      isPending={createMutation.isPending}
                      pendingLabel={t("submitting")}
                      submitLabel={tDenali("review.submit")}
                      ruleSet={mergedRuleSet}
                      visibleSteps={visibleSteps}
                      onSubmit={onSubmit}
                    />
                  )}
                </div>
              </form>
            </CardBody>
          </Card>
          </DenaliWizardNavigationProvider>
          </DenaliWizardSyncProvider>
        </DenaliCanonicalProvider>
      </FormProvider>
    </QuickAddModalProvider>
  );
}
