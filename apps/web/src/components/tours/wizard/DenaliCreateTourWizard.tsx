"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Button, Card, CardBody } from "@tour/ui";

import { formatWizardApiErrorMessage } from "@/features/tours/wizard/format-wizard-api-error";
import { useDenaliTourWizardCreate } from "@/features/tours/wizard/hooks/useDenaliTourWizardCreate";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import { isWizardSubmitLocked } from "@/features/tours/wizard/wizardSubmitLock";
import { clearWizardSubmitIdempotencyKey } from "@/features/tours/wizard/wizardSubmitSession";
import { useTenantContext } from "@/lib/tenant/tenant-provider";
import { deleteTourWizardDraft } from "@/lib/tour-wizard-draft.client";
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
  DenaliLogisticsStep,
  DenaliPhotosStep,
} from "@/features/tours/wizard/denali";
import { sanitizeDenaliWizardCatalogRefs } from "@/features/tours/wizard/denali/sanitizeDenaliWizardCatalogRefs";
import { preserveDenaliWizardBlobMedia } from "@/features/tours/wizard/denali/preserveDenaliWizardBlobMedia";
import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import { getDenaliWizardPublishReadinessIssues } from "@/features/tours/wizard/denali/validation/denaliWizardPublishReadiness";
import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import { DenaliWizardSyncProvider } from "@/features/tours/wizard/denali/DenaliWizardSyncContext";
import {
  isDenaliCloneOrPresetPrefill,
  readDenaliPrefillFromLocalStorage,
} from "@/features/tours/wizard/denali/bootstrapDenaliPrefillDraft";
import { mergeDenaliWizardDefaults } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import { useTourWizardDraftStorageKey } from "@/features/tours/wizard/useTourWizardDraftStorageKey";
import {
  resolveWizardDraftStorageKeyForBrowserHost,
  purgeAllWizardDraftLocalStorageKeys,
} from "@/features/tours/wizard/tourWizardDraftEnvelope";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { denaliCanonicalWizardResolver } from "@/features/tours/wizard/schemas/denaliWizardCanonicalResolver";
import { applyDenaliWizardStepValidation } from "@/features/tours/wizard/schemas/denaliTourCreateValidation";
import { logDenaliWizardDiagnosticReport } from "@/features/tours/wizard/denali/denaliWizardDiagnostic";

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
  switch (stepId) {
    case "denali_basic":
      return <DenaliBasicInfoStep />;
    case "denali_program":
      return <DenaliProgramNatureStep />;
    case "denali_logistics":
      return <DenaliLogisticsStep />;
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
  const themesQuery = useSettingsTourThemes();
  const destinationsQuery = useTourDestinations();
  const wizardTemplateQuery = useTenantWizardTemplate();
  const createMutation = useDenaliTourWizardCreate();
  const submitLocked = isWizardSubmitLocked(createMutation);
  const workspaceFormProfile = resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data);
  const visibleSteps = denaliWizardSteps;
  const [currentStep, setCurrentStep] = useState(0);
  const [canonicalSyncToken, setCanonicalSyncToken] = useState(0);
  const [wizardReady, setWizardReady] = useState(false);

  const defaultValues = useMemo(() => buildDenaliTourCreateDefaultValues(), []);
  const formMethods = useForm<DenaliCreateTourWizardForm>({
    resolver: denaliCanonicalWizardResolver,
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues,
  });

  const { handleSubmit, getValues, setError, clearErrors, reset } = formMethods;
  const draftStorageKey = useTourWizardDraftStorageKey();
  const hydrateStartedRef = useRef(false);
  const draftWizardMetaRef = useRef<
    import("@/features/tours/wizard/tourWizardProfileResolve").TourWizardDraftMeta | undefined
  >(undefined);

  const navLocked = submitLocked;

  useEffect(() => {
    if (hydrateStartedRef.current) {
      return;
    }
    const template = wizardTemplateQuery.data;
    if (!template) {
      return;
    }
    hydrateStartedRef.current = true;

    if (!isWorkspaceUuid(workspaceId)) {
      setWizardReady(true);
      return;
    }

    void (async () => {
      const storageKey = resolveWizardDraftStorageKeyForBrowserHost(draftStorageKey);
      const localPrefill = readDenaliPrefillFromLocalStorage(storageKey);
      const mayApplyCloneOrPreset =
        localPrefill != null && isAuthenticatedCloneOrPresetPrefill(localPrefill);

      if (mayApplyCloneOrPreset && localPrefill?.formPatch) {
        purgeAllWizardDraftLocalStorageKeys(storageKey);
        const merged = mergeDenaliWizardDefaults(defaultValues, localPrefill.formPatch);
        if (localPrefill.wizardMeta) {
          draftWizardMetaRef.current = {
            ...localPrefill.wizardMeta,
            resolvedFormProfile: workspaceFormProfile,
            formProfileVersion:
              localPrefill.wizardMeta.formProfileVersion ?? TOUR_FORM_PROFILE_VERSION,
          };
        }
        reset(merged);
        setCanonicalSyncToken((token) => token + 1);
        setWizardReady(true);
        return;
      }

      purgeAllWizardDraftLocalStorageKeys(storageKey);
      if (searchParams.get("new") === "true" || !mayApplyCloneOrPreset) {
        await purgeDenaliWizardDraftStorage(workspaceId, draftStorageKey);
      }
      reset(defaultValues);
      setCurrentStep(0);
      setCanonicalSyncToken((token) => token + 1);
      setWizardReady(true);
    })();
  }, [
    defaultValues,
    draftStorageKey,
    reset,
    searchParams,
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
    const next = applyDenaliInvariantState(sanitized);
    reset(next, { keepDefaultValues: true });
    setCanonicalSyncToken((token) => token + 1);
  }, [destinationsQuery.groupedRegions, getValues, reset, themesQuery.data, wizardReady]);

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
      ).length > 0
    );
  }, [currentStepKey, formForPublishGate, workspaceFormProfile]);

  const handleNext = useCallback(async () => {
    const values = getValues();
    const normalized = applyDenaliInvariantState(values);
    const withBlobs = preserveDenaliWizardBlobMedia(values, normalized);
    reset(withBlobs, { keepDefaultValues: true, keepDirty: true });
    setCanonicalSyncToken((token) => token + 1);

    const ok = applyDenaliWizardStepValidation(
      withBlobs,
      currentStepKey,
      setError,
      clearErrors,
    );

    if (ok) {
      setCurrentStep((prev) => Math.min(prev + 1, visibleSteps.length - 1));
      window.scrollTo(0, 0);
    }
  }, [clearErrors, currentStepKey, getValues, reset, setCanonicalSyncToken, setError, visibleSteps.length]);

  const onSubmit = useCallback(
    async (values: DenaliCreateTourWizardForm) => {
      const safeValues = applyDenaliInvariantState(values);
      if (
        safeValues.basicInfo.publishStatus === "active" &&
        getDenaliWizardPublishReadinessIssues(safeValues, workspaceFormProfile).length > 0
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
          workspaceFormProfile,
          themeCatalog,
          sourcePresetId: draftWizardMetaRef.current?.sourcePresetId,
          sourceTourId: draftWizardMetaRef.current?.sourceTourId,
        });
      } catch {
        return;
      }
      clearWizardSubmitIdempotencyKey();
      if (isWorkspaceUuid(workspaceId)) {
        void purgeDenaliWizardDraftStorage(workspaceId, draftStorageKey);
      }
      router.push("/tours");
      router.refresh();
    },
    [
      clearErrors,
      createMutation,
      draftStorageKey,
      router,
      setError,
      tDenali,
      themesQuery.data,
      workspaceFormProfile,
      workspaceId,
    ],
  );

  const onInvalid = useCallback(
    (fieldErrors: typeof formMethods.formState.errors) => {
      const values = getValues();
      logDenaliWizardDiagnosticReport({
        form: values,
        activeEquipment: undefined,
        source: "submit-invalid-rhf",
      });
      console.warn("[denali-wizard] submit invalid — RHF fieldErrors:", fieldErrors);
      const firstError = Object.keys(fieldErrors)[0];
      if (firstError) {
        const el =
          document.getElementsByName(firstError)[0] ||
          document.querySelector(`[data-testid*="${firstError}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    },
    [formMethods.formState.errors, getValues],
  );

  const submitErrorMessage = createMutation.error
    ? formatWizardApiErrorMessage(createMutation.error, t("mutationGenericFailed"))
    : null;

  if (!wizardReady) {
    return null;
  }

  return (
    <FormProvider {...formMethods}>
      <DenaliCanonicalProvider formMethods={formMethods} syncToken={canonicalSyncToken}>
        <DenaliWizardSyncProvider isSyncing={false}>
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
                <DenaliWizardStepper steps={visibleSteps} currentIndex={currentStep} />

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
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void handleSubmit(onSubmit, onInvalid)()}
                      disabled={navLocked || openPublishBlocked}
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
