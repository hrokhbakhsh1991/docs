"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Controller, FormProvider, useForm, useFormContext } from "react-hook-form";
import { Alert, Button, Card, CardBody } from "@tour/ui";

import { TourPublishStatusField } from "@/components/tours/TourPublishStatusField";
import type { TourFormLifecycleStatus } from "@/components/tours/tour-lifecycle";
import {
  collectTourFormValidationIssues,
  scrollTourFormToFirstError,
  type TourFormErrorLabelContext,
} from "@/components/tours/tourFormValidationSummary";
import { transformTourToDenaliWizardValues } from "@/features/tours/clone/transformTourToDenaliWizardValues";
import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import { formatWizardApiErrorMessage } from "@/features/tours/wizard/format-wizard-api-error";
import {
  DenaliBasicInfoStep,
  DenaliLogisticsStep,
  DenaliPhotosStep,
  DenaliPricingPaymentStep,
  DenaliProgramNatureStep,
} from "@/features/tours/wizard/denali";
import { DenaliCanonicalProvider } from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import { useDenaliEditCatalogSanitize } from "@/features/tours/wizard/denali/hooks/useDenaliEditCatalogSanitize";
import { useDenaliPublishReadiness } from "@/features/tours/wizard/denali/hooks/useDenaliPublishReadiness";
import { useDenaliStepFieldRules } from "@/features/tours/wizard/denali/hooks/useDenaliStepFieldRules";
import {
  denaliWizardSteps,
  getDenaliStepTitleFa,
  type DenaliCreateWizardStepId,
} from "@/features/tours/wizard/denaliStepConfig";
import { mergeDenaliWizardDefaults } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { denaliCanonicalWizardResolver } from "@/features/tours/wizard/schemas/denaliWizardCanonicalResolver";
import { ApiError } from "@/lib/api-client";
import type { TourDetailDto } from "@/lib/services/tours.service";

import styles from "./DenaliTourEditForm.module.css";

const denaliEditSections = denaliWizardSteps.filter(
  (step): step is Exclude<DenaliCreateWizardStepId, "review"> => step !== "review",
);

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

function DenaliEditStepBody({ stepId }: { stepId: Exclude<DenaliCreateWizardStepId, "review"> }) {
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

export type DenaliTourEditFormProps = {
  tour: TourDetailDto;
  onCancel: () => void;
  onSubmit: (values: DenaliCreateTourWizardForm) => Promise<void>;
  submitError?: unknown;
};

export function DenaliTourEditForm({ tour, onCancel, onSubmit, submitError }: DenaliTourEditFormProps) {
  const t = useTranslations("tours.denali");
  const tNew = useTranslations("tours.new");
  const tForm = useTranslations("tours.form");
  const [canonicalSyncToken, setCanonicalSyncToken] = useState(0);
  const bumpCanonicalSync = useCallback(() => {
    setCanonicalSyncToken((token) => token + 1);
  }, []);

  const defaultValues = useMemo(() => {
    const patch = transformTourToDenaliWizardValues(tour as TourCloneSourceDto, { mode: "clone" });
    return mergeDenaliWizardDefaults(buildDenaliTourCreateDefaultValues(), patch);
  }, [tour]);

  const formMethods = useForm<DenaliCreateTourWizardForm>({
    resolver: denaliCanonicalWizardResolver,
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues,
  });

  const {
    handleSubmit,
    reset,
    getValues,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = formMethods;

  useEffect(() => {
    reset(defaultValues);
    bumpCanonicalSync();
  }, [bumpCanonicalSync, defaultValues, reset]);

  useDenaliEditCatalogSanitize({ getValues, reset }, bumpCanonicalSync);

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

  const onInvalid = useCallback(
    (fieldErrors: typeof errors) => {
      const issues = collectTourFormValidationIssues(fieldErrors, errorLabelContext);
      scrollTourFormToFirstError(issues);
    },
    [errorLabelContext],
  );

  const submitValid = useCallback(
    async (values: DenaliCreateTourWizardForm) => {
      try {
        await onSubmit(values);
      } catch (err) {
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
    [onSubmit, setError, tForm],
  );

  const mutationErrorMessage = submitError
    ? formatWizardApiErrorMessage(submitError, tForm("saveFailed"))
    : null;

  return (
    <FormProvider {...formMethods}>
      <DenaliCanonicalProvider formMethods={formMethods} syncToken={canonicalSyncToken}>
        <Card
          data-testid="denali-edit-tour-form"
          data-denali-wizard-root="true"
          data-wizard-rail="denali"
          data-resolved-form-profile="denali_pilot"
          title={t("edit.pageTitle")}
          description={t("edit.pageDescription")}
        >
          <CardBody>
            <form
              className={styles.inner}
              noValidate
              onSubmit={handleSubmit(submitValid, onInvalid)}
            >
              <DenaliEditPublishSection />

              {denaliEditSections.map((stepId) => (
                <DenaliEditSection key={stepId} stepId={stepId} title={getDenaliStepTitleFa(stepId)}>
                  <DenaliEditStepBody stepId={stepId} />
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

              <div className={styles.actions}>
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                  {tForm("cancel")}
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? tForm("saving") : tForm("saveChanges")}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </DenaliCanonicalProvider>
    </FormProvider>
  );
}
