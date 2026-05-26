"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { Alert, Button, Card, CardBody, LoadingState } from "@tour/ui";

import { TourPublishStatusField } from "@/components/tours/TourPublishStatusField";
import { QuickAddModalProvider } from "@/components/shared/QuickAddModal";
import type { TourFormLifecycleStatus } from "@/components/tours/tour-lifecycle";
import {
  collectTourFormValidationIssues,
  labelTourFormErrorPath,
  scrollTourFormToFirstError,
  type TourFormErrorLabelContext,
} from "@/components/tours/tourFormValidationSummary";
import { transformTourToDenaliWizardValues } from "@/features/tours/clone/transformTourToDenaliWizardValues";
import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import { mapTemplateToRuleModel } from "@/features/tours/wizard/domain/ruleModelConverter";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { formatWizardApiErrorMessage } from "@/features/tours/wizard/format-wizard-api-error";
import {
  DenaliBasicInfoStep,
  DenaliLogisticsStep,
  DenaliPricingStep,
  DenaliProgramNatureStep,
} from "@/features/tours/wizard/denali";
import { DenaliPhotosStep } from "@/features/tours/wizard/denali/steps/DenaliPhotosStep";
import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import { DenaliWizardDraftAutosave } from "@/features/tours/wizard/denali/DenaliWizardDraftAutosave";
import { bootstrapDenaliEditFormFromDraft } from "@/features/tours/wizard/denali/denaliEditDraftBootstrap";
import { finalizeDenaliWizardHydration } from "@/features/tours/wizard/denali/denaliFormHydration";
import {
  hydrateAsyncAssets,
  readTourGalleryAsyncAssets,
} from "@/features/tours/wizard/denali/hydrateAsyncAssets";
import { denaliWizardTourEditDraftStorageKey } from "@/features/tours/wizard/denali/denaliWizardDraftStorageKeys";
import { useDenaliEditCatalogSanitize } from "@/features/tours/wizard/denali/hooks/useDenaliEditCatalogSanitize";
import { useDenaliEditRuleSync } from "@/features/tours/wizard/denali/hooks/useDenaliEditRuleSync";
import { useDenaliPublishReadiness } from "@/features/tours/wizard/denali/hooks/useDenaliPublishReadiness";
import { useDenaliStepFieldRules } from "@/features/tours/wizard/denali/hooks/useDenaliStepFieldRules";
import { saveDraft } from "@/features/tours/wizard/denali/denaliWizardDraftSave";
import { isDenaliDraftEnabled } from "@/features/tours/wizard/is-denali-draft-enabled";
import {
  clearDenaliWizardDraftFromStorage,
  readDenaliWizardDraftFromStorage,
  tryMigrateDenaliWizardDraft,
} from "@/features/tours/wizard/denali/safeDraftHydration";
import {
  getDenaliWizardVisibleSteps,
  prepareDenaliWizardFormForSubmit,
} from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import type { DenaliTourEditPatchIntent } from "@/features/tours/edit/updateTourDtoFromDenaliWizardForm";
import { getDenaliWizardSubmitIssues } from "@/features/tours/wizard/denali/validation/denaliWizardFormZod";
import { getDenaliWizardPublishReadinessIssues } from "@/features/tours/wizard/denali/validation/denaliWizardPublishReadiness";
import {
  getDenaliStepTitleFa,
  type DenaliCreateWizardStepId,
} from "@/features/tours/wizard/denaliStepConfig";
import {
  mergeDenaliWizardDefaults,
  serializeDenaliWizardDraft,
  type ParsedDenaliWizardDraft,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { createDenaliCanonicalWizardResolver } from "@/features/tours/wizard/schemas/denaliWizardCanonicalResolver";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";
import { ApiError } from "@/lib/api-client";
import {
  applyApiValidationErrorsToForm,
  extractApiValidationErrors,
  mapApiValidationPathToDenaliFormPath,
} from "@/lib/errors/apply-api-validation-errors";
import type { TourDetailDto } from "@/lib/services/tours.service";

import styles from "./DenaliTourEditForm.module.css";

/** Dev aid: log canonical submit gate before RHF rejects save (schema / registry drift). */
function logDenaliEditSubmitIssuesBeforeReject(
  context: string,
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet,
): ReturnType<typeof getDenaliWizardSubmitIssues> {
  const normalized = prepareDenaliWizardFormForSubmit(form, ruleSet);
  const issues = getDenaliWizardSubmitIssues(normalized, undefined, ruleSet);
  if (issues.length > 0) {
    console.error(`[DenaliTourEditForm] ${context} — getDenaliWizardSubmitIssues`, {
      issueCount: issues.length,
      issues: issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
      rawIssues: issues,
    });
  }
  return issues;
}

function DenaliEditSection({
  stepId,
  title,
  children,
}: {
  stepId: Exclude<DenaliCreateWizardStepId, "review">;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className={styles.section}
      id={`denali-edit-${stepId}`}
      data-testid={`denali-edit-section-${stepId}`}
    >
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function DenaliEditStepBody({
  stepId,
  tourId,
}: {
  stepId: Exclude<DenaliCreateWizardStepId, "review">;
  tourId: string;
}) {
  switch (stepId) {
    case "denali_basic":
      return <DenaliBasicInfoStep />;
    case "denali_program":
      return <DenaliProgramNatureStep />;
    case "denali_logistics":
      return <DenaliLogisticsStep />;
    case "denali_pricing":
      return <DenaliPricingStep />;
    case "denali_photos":
      return <DenaliPhotosStep tourId={tourId} />;
    default:
      return null;
  }
}

function DenaliEditPublishSection() {
  const tDenali = useTranslations("tours.denali");
  const { control, getValues } = useFormContext<DenaliCreateTourWizardForm>();
  const { isVisible } = useDenaliStepFieldRules("denali_basic");
  const { publishReadinessBlocked, disableActivePublish, issues: publishReadinessIssues } =
    useDenaliPublishReadiness();

  if (!isVisible("publishStatus", getValues())) {
    return null;
  }

  return (
    <div className={styles.publishBlock} data-testid="denali-edit-publish-section">
      <Controller
        control={control}
        name="basicInfo.publishStatus"
        render={({ field }) => {
          const uiValue: TourFormLifecycleStatus = field.value === "active" ? "active" : "draft";
          return (
            <TourPublishStatusField
              value={uiValue}
              allowArchived={false}
              disableValues={disableActivePublish ? (["active"] as const) : undefined}
              onChange={(next) => {
                field.onChange(next === "active" ? "active" : "draft");
              }}
            />
          );
        }}
      />
      {publishReadinessBlocked ? (
        <div role="alert" data-testid="denali-edit-publish-readiness-blocked">
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.875rem", fontWeight: 600 }}>
            {tDenali("review.publishDraftOnlyWarning")}
          </p>
          <ul className={styles.publishReadinessList}>
            {publishReadinessIssues.map((issue) => (
              <li key={`${issue.code}-${issue.path ?? issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DenaliEditFormActions({
  tourLifecycleStatus,
  isSubmitting,
  onCancel,
  onSave,
  onPublish,
}: {
  tourLifecycleStatus: TourDetailDto["lifecycleStatus"];
  isSubmitting: boolean;
  onCancel: () => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  const t = useTranslations("tours.denali");
  const tForm = useTranslations("tours.form");
  const { issues } = useDenaliPublishReadiness({ disableActiveWhileNotReady: true });
  const showPublish = tourLifecycleStatus === "DRAFT";

  return (
    <div className={styles.actions}>
      <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
        {tForm("cancel")}
      </Button>
      {showPublish ? (
        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting || issues.length > 0}
          onClick={onPublish}
          data-testid="denali-edit-publish"
        >
          {isSubmitting ? t("edit.publishing") : t("edit.publishTour")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="primary"
        disabled={isSubmitting}
        onClick={onSave}
        data-testid="denali-edit-save"
      >
        {isSubmitting ? tForm("saving") : tForm("saveChanges")}
      </Button>
    </div>
  );
}

export type DenaliTourEditSubmitMeta = {
  intent: DenaliTourEditPatchIntent;
};

export type DenaliTourEditFormProps = {
  tour: TourDetailDto;
  onCancel: () => void;
  onSubmit: (values: DenaliCreateTourWizardForm, meta: DenaliTourEditSubmitMeta) => Promise<void>;
  submitError?: unknown;
};

export function DenaliTourEditForm({
  tour,
  onCancel,
  onSubmit,
  submitError,
}: DenaliTourEditFormProps) {
  const t = useTranslations("tours.denali");
  const tNew = useTranslations("tours.new");
  const tForm = useTranslations("tours.form");
  const wizardTemplateQuery = useTenantWizardTemplate();
  const workspaceFormProfile = useMemo(
    () => resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data),
    [wizardTemplateQuery.data],
  );
  const mappedTemplateRules = useMemo(
    () => mapTemplateToRuleModel(wizardTemplateQuery.data ?? null),
    [wizardTemplateQuery.data],
  );
  const mergedRuleSet = useMemo(
    () => mappedTemplateRules.ruleSet,
    [mappedTemplateRules],
  );
  const ruleSetRef = useRef(mergedRuleSet);
  ruleSetRef.current = mergedRuleSet;

  const editDraftStorageKey = useMemo(
    () => denaliWizardTourEditDraftStorageKey(tour.id),
    [tour.id],
  );

  const [canonicalSyncToken, setCanonicalSyncToken] = useState(0);
  const bumpCanonicalSync = useCallback(() => {
    setCanonicalSyncToken((token) => token + 1);
  }, []);

  const [formBootstrapped, setFormBootstrapped] = useState(false);
  const [showIncompatibleDraftBanner, setShowIncompatibleDraftBanner] = useState(false);
  const editHydrateStartedForTourRef = useRef<string | null>(null);
  const pendingIncompatibleDraftRef = useRef<ParsedDenaliWizardDraft | null>(null);
  const draftWizardMetaRef = useRef<TourWizardDraftMeta>({
    sourceTourId: tour.id,
    resolvedFormProfile: workspaceFormProfile,
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  });

  const serverBaseline = useMemo(() => {
    const patch = transformTourToDenaliWizardValues(tour as TourCloneSourceDto, {
      mode: "clone",
      preserveGalleryPhotoIds: true,
    });
    const merged = mergeDenaliWizardDefaults(
      buildDenaliTourCreateDefaultValues(),
      patch,
      mergedRuleSet,
    );
    const wirePhotos = readTourGalleryAsyncAssets(tour);
    const hydratedPhotos = hydrateAsyncAssets(wirePhotos);
    const withPhotos =
      hydratedPhotos.length > 0
        ? {
            ...merged,
            photosData: {
              ...merged.photosData,
              photos: hydratedPhotos,
            },
          }
        : merged;
    return finalizeDenaliWizardHydration(
      prepareDenaliWizardFormForSubmit(withPhotos, mergedRuleSet),
      mergedRuleSet,
    );
  }, [mergedRuleSet, tour]);

  const resolver = useMemo(
    () =>
      createDenaliCanonicalWizardResolver(
        () => ({ workspaceFormProfile }),
        () => ruleSetRef.current,
      ),
    [workspaceFormProfile],
  );

  const formMethods = useForm<DenaliCreateTourWizardForm>({
    resolver,
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: serverBaseline,
  });

  const {
    handleSubmit,
    reset,
    getValues,
    setError,
    clearErrors,
    control,
    trigger,
    formState: { errors, isSubmitting, isSubmitted },
  } = formMethods;

  useEffect(() => {
    draftWizardMetaRef.current = {
      sourceTourId: tour.id,
      resolvedFormProfile: workspaceFormProfile,
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    };
  }, [tour.id, workspaceFormProfile]);

  useEffect(() => {
    if (wizardTemplateQuery.isLoading || !wizardTemplateQuery.data) {
      return;
    }
    if (editHydrateStartedForTourRef.current === tour.id) {
      return;
    }
    editHydrateStartedForTourRef.current = tour.id;

    const bootstrap = bootstrapDenaliEditFormFromDraft({
      tourId: tour.id,
      serverBaseline,
      ruleSet: mergedRuleSet,
    });

    pendingIncompatibleDraftRef.current = bootstrap.incompatibleDraft;
    setShowIncompatibleDraftBanner(bootstrap.incompatibleDraft != null);
    reset(bootstrap.initialValues);
    bumpCanonicalSync();
    setFormBootstrapped(true);

    if (bootstrap.restoredFromDraft) {
      saveDraft(
        editDraftStorageKey,
        bootstrap.initialValues,
        draftWizardMetaRef.current,
        { ruleSet: mergedRuleSet },
      );
    }
  }, [
    bumpCanonicalSync,
    editDraftStorageKey,
    mergedRuleSet,
    reset,
    serverBaseline,
    tour.id,
    wizardTemplateQuery.data,
    wizardTemplateQuery.isLoading,
  ]);

  const clearEditDraft = useCallback(() => {
    pendingIncompatibleDraftRef.current = null;
    setShowIncompatibleDraftBanner(false);
    clearDenaliWizardDraftFromStorage(editDraftStorageKey);
    reset(serverBaseline);
    bumpCanonicalSync();
  }, [bumpCanonicalSync, editDraftStorageKey, reset, serverBaseline]);

  const handleMigrateEditDraft = useCallback(() => {
    const draft =
      pendingIncompatibleDraftRef.current ??
      readDenaliWizardDraftFromStorage(editDraftStorageKey);
    const hydrated = tryMigrateDenaliWizardDraft(draft, serverBaseline, {
      ruleSet: mergedRuleSet,
    });
    if (!hydrated) {
      clearEditDraft();
      return;
    }
    reset(hydrated.formValues);
    bumpCanonicalSync();
    pendingIncompatibleDraftRef.current = null;
    setShowIncompatibleDraftBanner(false);
    saveDraft(
      editDraftStorageKey,
      hydrated.formValues,
      draftWizardMetaRef.current,
      { ruleSet: mergedRuleSet },
    );
  }, [
    bumpCanonicalSync,
    clearEditDraft,
    editDraftStorageKey,
    mergedRuleSet,
    reset,
    serverBaseline,
  ]);

  const tourTypeWatch = useWatch({ control, name: "basicInfo.tourType" });
  const transportModeWatch = useWatch({ control, name: "transport.transportMode" });
  const adminCapacityApprovalWatch = useWatch({
    control,
    name: "transport.adminCapacityApproval",
  });
  const allowPersonalCarWatch = useWatch({ control, name: "transport.allowPersonalCar" });
  const requiresPaymentWatch = useWatch({
    control,
    name: "pricingPayment.requiresPayment",
  });

  const visibleEditSections = useMemo((): Exclude<DenaliCreateWizardStepId, "review">[] => {
    return getDenaliWizardVisibleSteps(getValues(), mergedRuleSet).filter(
      (step): step is Exclude<DenaliCreateWizardStepId, "review"> => step !== "review",
    );
  }, [
    adminCapacityApprovalWatch,
    allowPersonalCarWatch,
    getValues,
    mergedRuleSet,
    requiresPaymentWatch,
    tourTypeWatch,
    transportModeWatch,
  ]);

  useDenaliEditCatalogSanitize(
    { getValues, reset },
    bumpCanonicalSync,
    mergedRuleSet,
    workspaceFormProfile,
  );
  useDenaliEditRuleSync(
    { control, getValues, reset, trigger },
    mergedRuleSet,
    bumpCanonicalSync,
    { enabled: formBootstrapped, workspaceFormProfile },
  );

  const errorLabelContext = useMemo(
    (): TourFormErrorLabelContext => ({
      tNew,
      tDenali: t,
      tForm,
    }),
    [t, tForm, tNew],
  );

  const validationIssues = useMemo(
    () => collectTourFormValidationIssues(errors, errorLabelContext),
    [errors, errorLabelContext],
  );

  const applyServerValidationErrors = useCallback(
    (err: ApiError): boolean => {
      if (err.code !== "VALIDATION_FAILED") {
        return false;
      }
      const validationErrors = extractApiValidationErrors(err);
      const applied = applyApiValidationErrorsToForm(setError, validationErrors);
      if (applied === 0) {
        return false;
      }
      clearErrors("root");
      const scrollIssues = validationErrors.flatMap((row) => {
        const formPath = mapApiValidationPathToDenaliFormPath(row.path);
        if (!formPath) {
          return [];
        }
        return [
          {
            path: String(formPath),
            label: labelTourFormErrorPath(formPath, errorLabelContext),
            message: row.message,
          },
        ];
      });
      scrollTourFormToFirstError(scrollIssues);
      return true;
    },
    [clearErrors, errorLabelContext, setError],
  );

  useEffect(() => {
    if (!(submitError instanceof ApiError)) {
      return;
    }
    applyServerValidationErrors(submitError);
  }, [applyServerValidationErrors, submitError]);

  const onInvalid = useCallback(
    (fieldErrors: typeof errors) => {
      logDenaliEditSubmitIssuesBeforeReject(
        "handleSubmit rejected (resolver/onInvalid)",
        getValues(),
        ruleSetRef.current,
      );
      const issues = collectTourFormValidationIssues(fieldErrors, errorLabelContext);
      scrollTourFormToFirstError(issues);
    },
    [errorLabelContext, getValues],
  );

  const submitValid = useCallback(
    async (values: DenaliCreateTourWizardForm, intent: DenaliTourEditPatchIntent) => {
      const submitGateIssues = logDenaliEditSubmitIssuesBeforeReject(
        "submitValid preflight (before PATCH)",
        values,
        ruleSetRef.current,
      );
      if (submitGateIssues.length > 0) {
        return;
      }

      if (intent === "publish") {
        const publishIssues = getDenaliWizardPublishReadinessIssues(
          values,
          workspaceFormProfile,
          mergedRuleSet,
        );
        if (publishIssues.length > 0) {
          console.error("[DenaliTourEditForm] publish blocked — readiness issues", publishIssues);
          setError("root", {
            type: "publish",
            message: t("review.publishSubmitBlocked"),
          });
          return;
        }
      }

      const prepared =
        intent === "publish"
          ? {
              ...values,
              basicInfo: { ...values.basicInfo, publishStatus: "active" as const },
            }
          : values;
      const safeValues = prepareDenaliWizardFormForSubmit(prepared, mergedRuleSet);

      try {
        await onSubmit(safeValues, { intent });
        clearDenaliWizardDraftFromStorage(editDraftStorageKey);
      } catch (err) {
        logDenaliEditSubmitIssuesBeforeReject(
          "submitValid caught error (client gate vs API)",
          safeValues,
          ruleSetRef.current,
        );
        if (err instanceof ApiError && applyServerValidationErrors(err)) {
          return;
        }
        if (err instanceof ApiError) {
          setError("root", {
            type: "server",
            message: formatWizardApiErrorMessage(err, tForm("saveFailed")),
          });
          return;
        }
        setError("root", {
          type: "submit",
          message: err instanceof Error ? err.message : tForm("saveFailed"),
        });
      }
    },
    [
      applyServerValidationErrors,
      editDraftStorageKey,
      mergedRuleSet,
      onSubmit,
      setError,
      t,
      tForm,
      workspaceFormProfile,
    ],
  );

  const runSubmit = useCallback(
    (intent: DenaliTourEditPatchIntent) =>
      handleSubmit((values) => submitValid(values, intent), onInvalid),
    [handleSubmit, onInvalid, submitValid],
  );

  const mutationErrorMessage =
    submitError instanceof ApiError && submitError.code === "VALIDATION_FAILED"
      ? null
      : submitError
        ? formatWizardApiErrorMessage(submitError, tForm("saveFailed"))
        : null;

  const quickAddWizardPersistence = useMemo(
    () =>
      isDenaliDraftEnabled()
        ? {
            storageKey: editDraftStorageKey,
            getFormValues: () => getValues() as Record<string, unknown>,
            serializeDraft: (values: Record<string, unknown>) =>
              serializeDenaliWizardDraft(
                values as Partial<DenaliCreateTourWizardForm>,
                draftWizardMetaRef.current,
              ),
          }
        : undefined,
    [editDraftStorageKey, getValues],
  );

  if (wizardTemplateQuery.isLoading || !formBootstrapped) {
    return (
      <Card data-testid="denali-edit-tour-form-loading">
        <CardBody>
          <LoadingState message={tNew("loadingSession")} />
        </CardBody>
      </Card>
    );
  }

  return (
    <QuickAddModalProvider wizardPersistence={quickAddWizardPersistence}>
      <FormProvider {...formMethods}>
        {isDenaliDraftEnabled() ? (
          <DenaliWizardDraftAutosave
            enabled={formBootstrapped && !isSubmitting}
            draftStorageKey={editDraftStorageKey}
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
          uploadTourId={tour.id}
          workspaceFormProfile={workspaceFormProfile}
        >
        <Card
          data-testid="denali-edit-tour-form"
          data-denali-wizard-root="true"
          data-wizard-rail="denali"
          data-resolved-form-profile={workspaceFormProfile}
          title={t("edit.pageTitle")}
          description={t("edit.pageDescription")}
        >
          <CardBody>
            <form
              className={styles.inner}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void runSubmit("save")();
              }}
            >
              {showIncompatibleDraftBanner ? (
                <div
                  role="status"
                  className={styles.draftBanner}
                  data-testid="denali-edit-draft-incompatible-banner"
                >
                  <p style={{ margin: 0 }}>{t("draftHydration.incompatibleBanner")}</p>
                  <div className={styles.draftBannerActions}>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleMigrateEditDraft}
                      data-testid="denali-edit-draft-migrate"
                    >
                      {t("draftHydration.migrateDraft")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={clearEditDraft}
                      data-testid="denali-edit-draft-reset-fresh"
                    >
                      {t("draftHydration.resetAndStartFresh")}
                    </Button>
                  </div>
                </div>
              ) : null}

              <DenaliEditPublishSection />

              {visibleEditSections.map((stepId) => (
                <DenaliEditSection key={stepId} stepId={stepId} title={getDenaliStepTitleFa(stepId)}>
                  <DenaliEditStepBody stepId={stepId} tourId={tour.id} />
                </DenaliEditSection>
              ))}

              {isSubmitted && validationIssues.length > 0 ? (
                <Alert
                  variant="error"
                  title={tForm("validationSummaryTitle")}
                  role="alert"
                  data-testid="denali-edit-validation-summary"
                >
                  <p style={{ margin: "0 0 0.5rem" }}>{tForm("validationSummaryIntro")}</p>
                  <ul className={styles.fieldErrorList}>
                    {validationIssues.map((issue) => (
                      <li key={issue.path}>
                        <strong>{issue.label}:</strong> {issue.message}
                      </li>
                    ))}
                  </ul>
                </Alert>
              ) : null}

              {errors.root?.message ? (
                <Alert variant="error" role="alert" data-testid="denali-edit-submit-error">
                  {errors.root.message}
                </Alert>
              ) : null}

              {mutationErrorMessage ? (
                <Alert variant="error" role="alert" data-testid="denali-edit-mutation-error">
                  {mutationErrorMessage}
                </Alert>
              ) : null}

              <DenaliEditFormActions
                tourLifecycleStatus={tour.lifecycleStatus}
                isSubmitting={isSubmitting}
                onCancel={onCancel}
                onSave={() => void runSubmit("save")()}
                onPublish={() => void runSubmit("publish")()}
              />
            </form>
          </CardBody>
        </Card>
      </DenaliCanonicalProvider>
    </FormProvider>
    </QuickAddModalProvider>
  );
}
