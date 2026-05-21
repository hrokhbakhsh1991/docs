"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button, Card, CardBody } from "@tour/ui";

import { formatWizardApiErrorMessage } from "@/features/tours/wizard/format-wizard-api-error";
import { useDenaliTourWizardCreate } from "@/features/tours/wizard/hooks/useDenaliTourWizardCreate";
import { useTourWizardServerSync } from "@/features/tours/wizard/hooks/useTourWizardServerSync";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import { isWizardSubmitLocked } from "@/features/tours/wizard/wizardSubmitLock";
import { clearWizardSubmitIdempotencyKey } from "@/features/tours/wizard/wizardSubmitSession";
import { useTenantContext } from "@/lib/tenant/tenant-provider";
import {
  deleteTourWizardDraft,
  fetchTourWizardDraft,
  TOUR_WIZARD_DRAFT_INITIAL_VERSION,
} from "@/lib/tour-wizard-draft.client";
import {
  denaliWizardSteps,
  getDenaliStepTitleFa,
  type DenaliCreateWizardStepId,
} from "@/features/tours/wizard/denaliStepConfig";
import {
  DenaliBasicInfoStep,
  DenaliPricingPaymentStep,
  DenaliProgramNatureStep,
  DenaliReviewStep,
  DenaliTransportStep,
  DenaliPhotosStep,
} from "@/features/tours/wizard/denali";
import { sanitizeDenaliWizardCatalogRefs } from "@/features/tours/wizard/denali/sanitizeDenaliWizardCatalogRefs";
import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import { DenaliWizardSyncProvider } from "@/features/tours/wizard/denali/DenaliWizardSyncContext";
import {
  bootstrapDenaliPrefillDraft,
  isDenaliCloneOrPresetPrefill,
  readDenaliPrefillFromLocalStorage,
} from "@/features/tours/wizard/denali/bootstrapDenaliPrefillDraft";
import {
  mergeDenaliWizardDefaults,
  parseDenaliWizardDraftEnvelope,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import { useTourWizardDraftStorageKey } from "@/features/tours/wizard/useTourWizardDraftStorageKey";
import { resolveWizardDraftStorageKeyForBrowserHost } from "@/features/tours/wizard/tourWizardDraftEnvelope";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { denaliCanonicalWizardResolver } from "@/features/tours/wizard/schemas/denaliWizardCanonicalResolver";
import { applyDenaliWizardStepValidation } from "@/features/tours/wizard/schemas/denaliTourCreateValidation";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isWorkspaceUuid(scope: string | null): scope is string {
  return scope != null && UUID_RE.test(scope.trim());
}

function DenaliWizardCloudSyncStatus({
  isSyncing,
  syncSettled,
  syncConflict,
  syncConflictMessage,
  onRefreshDraft,
}: {
  isSyncing: boolean;
  syncSettled: boolean;
  syncConflict: boolean;
  syncConflictMessage: string | null;
  onRefreshDraft: () => void;
}) {
  if (syncConflict) {
    return (
      <div
        data-testid="denali-wizard-cloud-sync-conflict"
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.35rem",
          maxWidth: "18rem",
        }}
      >
        <span style={{ fontSize: "0.8rem", color: "var(--color-danger-800, #991b1b)" }}>
          {syncConflictMessage ?? "پیش‌نویس در جای دیگری ذخیره شده است."}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onRefreshDraft}
          data-testid="denali-wizard-cloud-sync-refresh"
        >
          بارگذاری آخرین پیش‌نویس
        </Button>
      </div>
    );
  }
  if (isSyncing) {
    return (
      <span
        data-testid="denali-wizard-cloud-sync-active"
        style={{ fontSize: "0.8rem", color: "#475569", whiteSpace: "nowrap" }}
        aria-live="polite"
      >
        ذخیره در ابر... ☁️
      </span>
    );
  }
  if (syncSettled) {
    return (
      <span
        data-testid="denali-wizard-cloud-sync-settled"
        style={{ fontSize: "0.8rem", color: "#15803d", whiteSpace: "nowrap" }}
        aria-live="polite"
      >
        همگام‌سازی شد ✅
      </span>
    );
  }
  return null;
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
  switch (stepId) {
    case "denali_basic":
      return <DenaliBasicInfoStep />;
    case "denali_program":
      return <DenaliProgramNatureStep />;
    case "denali_transport":
      return <DenaliTransportStep />;
    case "denali_pricing":
      return <DenaliPricingPaymentStep />;
    case "denali_photos":
      return <DenaliPhotosStep />;
    case "review":
      return <DenaliReviewStep />;
    default:
      return null;
  }
}

export function DenaliCreateTourWizard() {
  const t = useTranslations("tours.new");
  const tDenali = useTranslations("tours.denali");
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenant = useTenantContext();
  const workspaceId = useWorkspaceQueryScope();
  const themesQuery = useSettingsTourThemes();
  const destinationsQuery = useTourDestinations();
  const wizardTemplateQuery = useTenantWizardTemplate();
  const createMutation = useDenaliTourWizardCreate();
  const submitLocked = isWizardSubmitLocked(createMutation);
  const workspaceFormProfile = resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data);
  /** Fixed MVP rail — no profile-based or dynamic step removal. */
  const visibleSteps = denaliWizardSteps;
  const [currentStep, setCurrentStep] = useState(0);
  const [canonicalSyncToken, setCanonicalSyncToken] = useState(0);
  const [serverHydrateReady, setServerHydrateReady] = useState(false);

  const defaultValues = useMemo(() => buildDenaliTourCreateDefaultValues(), []);
  const formMethods = useForm<DenaliCreateTourWizardForm>({
    resolver: denaliCanonicalWizardResolver,
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues,
  });

  const { handleSubmit, getValues, setError, clearErrors, reset } = formMethods;
  const draftStorageKey = useTourWizardDraftStorageKey();
  const draftRestoredRef = useRef(false);
  const draftWizardMetaRef = useRef<import("@/features/tours/wizard/tourWizardProfileResolve").TourWizardDraftMeta | undefined>(undefined);
  const draftVersionRef = useRef<number>(TOUR_WIZARD_DRAFT_INITIAL_VERSION);

  const serverSyncEnabled = serverHydrateReady && isWorkspaceUuid(workspaceId);

  const {
    isSyncing: draftSyncInFlight,
    syncSettled,
    syncConflict,
    syncConflictMessage,
    clearSyncConflict,
    noteDraftVersion,
    seedLastSyncedFingerprint,
  } = useTourWizardServerSync({
    workspaceId: isWorkspaceUuid(workspaceId) ? workspaceId : null,
    form: formMethods,
    currentStepIndex: currentStep,
    wizardMetaRef: draftWizardMetaRef,
    enabled: serverSyncEnabled,
    draftVersionRef,
  });

  const isSyncing = serverSyncEnabled && draftSyncInFlight;
  const navLocked = submitLocked || isSyncing;

  const applyServerDraftEnvelope = useCallback(
    (draft: Awaited<ReturnType<typeof fetchTourWizardDraft>>["draft"]) => {
      noteDraftVersion(draft?.version);
      if (draft?.payload && typeof draft.payload === "object") {
        const parsed = parseDenaliWizardDraftEnvelope(draft.payload);
        if (parsed?.formPatch) {
          draftWizardMetaRef.current = parsed.wizardMeta
            ? {
                ...parsed.wizardMeta,
                resolvedFormProfile: workspaceFormProfile,
                formProfileVersion: parsed.wizardMeta.formProfileVersion,
              }
            : undefined;
          reset(mergeDenaliWizardDefaults(defaultValues, parsed.formPatch));
          const stepIndex = Math.min(
            Math.max(0, draft.currentStepIndex ?? 0),
            visibleSteps.length - 1,
          );
          setCurrentStep(stepIndex);
          setCanonicalSyncToken((token) => token + 1);
        }
      } else {
        noteDraftVersion(TOUR_WIZARD_DRAFT_INITIAL_VERSION);
      }
      seedLastSyncedFingerprint();
    },
    [
      defaultValues,
      noteDraftVersion,
      reset,
      seedLastSyncedFingerprint,
      visibleSteps.length,
      workspaceFormProfile,
    ],
  );

  const reloadServerDraft = useCallback(async () => {
    if (!isWorkspaceUuid(workspaceId)) {
      return;
    }
    clearSyncConflict();
    try {
      const { draft } = await fetchTourWizardDraft(workspaceId);
      applyServerDraftEnvelope(draft);
    } catch {
      /* refresh failed — conflict banner may reappear on next PATCH */
    }
  }, [applyServerDraftEnvelope, clearSyncConflict, workspaceId]);

  useEffect(() => {
    if (draftRestoredRef.current) {
      return;
    }
    const template = wizardTemplateQuery.data;
    if (!template) {
      return;
    }
    if (!isWorkspaceUuid(workspaceId)) {
      draftRestoredRef.current = true;
      setServerHydrateReady(true);
      return;
    }

    const isExplicitNew = searchParams.get("new") === "true";
    if (isExplicitNew) {
      draftRestoredRef.current = true;
      setServerHydrateReady(true);
      void deleteTourWizardDraft(workspaceId).catch(() => {});
      noteDraftVersion(TOUR_WIZARD_DRAFT_INITIAL_VERSION);
      setCanonicalSyncToken((token) => token + 1);
      queueMicrotask(() => seedLastSyncedFingerprint());
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const storageKey = resolveWizardDraftStorageKeyForBrowserHost(draftStorageKey);
        const localPrefill = readDenaliPrefillFromLocalStorage(storageKey);
        if (localPrefill && isDenaliCloneOrPresetPrefill(localPrefill.wizardMeta)) {
          const bootstrapped = await bootstrapDenaliPrefillDraft(
            workspaceId,
            JSON.stringify({
              ...localPrefill.formPatch,
              _wizardRail: "denali",
              ...(localPrefill.wizardMeta ? { _wizardMeta: localPrefill.wizardMeta } : {}),
            }),
            defaultValues,
          );
          if (cancelled) {
            return;
          }
          if (bootstrapped) {
            draftWizardMetaRef.current = {
              ...bootstrapped.wizardMeta,
              resolvedFormProfile: workspaceFormProfile,
              formProfileVersion:
                bootstrapped.wizardMeta?.formProfileVersion ?? TOUR_FORM_PROFILE_VERSION,
            };
            reset(bootstrapped.formValues);
            noteDraftVersion(bootstrapped.draftVersion);
            setCanonicalSyncToken((token) => token + 1);
            seedLastSyncedFingerprint();
            draftRestoredRef.current = true;
            setServerHydrateReady(true);
            return;
          }
        }

        const { draft } = await fetchTourWizardDraft(workspaceId);
        if (cancelled) {
          return;
        }
        applyServerDraftEnvelope(draft);
      } catch {
        /* no server draft */
      } finally {
        if (!cancelled) {
          draftRestoredRef.current = true;
          setServerHydrateReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    defaultValues,
    reset,
    searchParams,
    visibleSteps.length,
    wizardTemplateQuery.data,
    applyServerDraftEnvelope,
    workspaceFormProfile,
    workspaceId,
    draftStorageKey,
    noteDraftVersion,
    seedLastSyncedFingerprint,
  ]);

  const catalogSanitizedRef = useRef(false);
  useLayoutEffect(() => {
    if (catalogSanitizedRef.current) {
      return;
    }
    if (!destinationsQuery.groupedRegions || !themesQuery.data) {
      return;
    }
    const destinationIds = new Set(
      destinationsQuery.groupedRegions.flatMap((g) => g.items.map((d) => d.id)),
    );
    const themeIds = new Set(
      (themesQuery.data ?? []).filter((t) => t.isActive).map((t) => t.id),
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
    const next = applyDenaliInvariantState(sanitized);
    reset(next, { keepDefaultValues: true });
    setCanonicalSyncToken((token) => token + 1);
  }, [destinationsQuery.groupedRegions, getValues, reset, themesQuery.data]);

  const currentStepKey = visibleSteps[currentStep]!;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === visibleSteps.length - 1;

  const handleNext = useCallback(async () => {
    const values = getValues();
    const normalized = applyDenaliInvariantState(values);
    reset(normalized, { keepDefaultValues: true, keepDirty: true });

    const ok = applyDenaliWizardStepValidation(
      normalized,
      currentStepKey,
      setError,
      clearErrors,
    );

    if (ok) {
      setCurrentStep((prev) => Math.min(prev + 1, visibleSteps.length - 1));
      window.scrollTo(0, 0);
    }
  }, [clearErrors, currentStepKey, getValues, reset, setError, visibleSteps.length]);

  const handleClearDraft = useCallback(() => {
    if (!window.confirm("آیا از پاک کردن پیش‌نویس و شروع مجدد اطمینان دارید؟")) {
      return;
    }

    if (isWorkspaceUuid(workspaceId)) {
      void deleteTourWizardDraft(workspaceId).catch(() => {});
    }

    draftWizardMetaRef.current = undefined;
    catalogSanitizedRef.current = false;
    reset(buildDenaliTourCreateDefaultValues());
    setCanonicalSyncToken((token) => token + 1);
    setCurrentStep(0);
    window.scrollTo(0, 0);
  }, [reset, workspaceId]);

  const onSubmit = useCallback(
    async (values: DenaliCreateTourWizardForm) => {
      const safeValues = applyDenaliInvariantState(values);
      const themeCatalog = (themesQuery.data ?? [])
        .filter((row) => row.isActive)
        .map((row) => ({ id: row.id, name: row.name }));
      try {
        await createMutation.mutateAsync({
          values: safeValues,
          workspaceFormProfile,
          themeCatalog,
          sourcePresetId: draftWizardMetaRef.current?.sourcePresetId,
          sourceTourId: draftWizardMetaRef.current?.sourceTourId,
        });
      } catch {
        return;
      }
      clearWizardSubmitIdempotencyKey();
      router.push("/tours");
      router.refresh();
    },
    [createMutation, router, themesQuery.data, workspaceFormProfile],
  );

  const onInvalid = useCallback(() => {
    const firstError = Object.keys(formMethods.formState.errors)[0];
    if (firstError) {
      const el =
        document.getElementsByName(firstError)[0] ||
        document.querySelector(`[data-testid*="${firstError}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [formMethods.formState.errors]);

  const submitErrorMessage = createMutation.error
    ? formatWizardApiErrorMessage(createMutation.error, t("mutationGenericFailed"))
    : null;

  return (
    <FormProvider {...formMethods}>
      <DenaliCanonicalProvider
        formMethods={formMethods}
        syncToken={canonicalSyncToken}
        resetWizard={handleClearDraft}
      >
        <DenaliWizardSyncProvider isSyncing={isSyncing}>
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
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "0.75rem",
                  justifyContent: "space-between",
                }}
              >
                <DenaliWizardStepper steps={visibleSteps} currentIndex={currentStep} />
                {serverSyncEnabled ? (
                  <DenaliWizardCloudSyncStatus
                    isSyncing={isSyncing}
                    syncSettled={syncSettled}
                    syncConflict={syncConflict}
                    syncConflictMessage={syncConflictMessage}
                    onRefreshDraft={() => void reloadServerDraft()}
                  />
                ) : null}
              </div>

              <div style={{ padding: "0.25rem 0" }}>
                <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                  گام {currentStep + 1} از {visibleSteps.length}: {getDenaliStepTitleFa(currentStepKey)}
                </h2>
              </div>

              <DenaliStepBody stepId={currentStepKey} />

              {isLastStep && submitErrorMessage ? (
                <p
                  role="alert"
                  style={{ margin: 0, fontSize: "0.9rem", color: "var(--color-danger-800, #991b1b)" }}
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
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => void handleSubmit(onSubmit, onInvalid)()}
                    disabled={navLocked}
                    data-testid="denali-wizard-final-submit"
                  >
                    {createMutation.isPending ? t("submitting") : tDenali("review.submit")}
                  </Button>
                )}
              </div>
            </form>
          </CardBody>
        </Card>
        </DenaliWizardSyncProvider>
      </DenaliCanonicalProvider>
    </FormProvider>
  );
}
