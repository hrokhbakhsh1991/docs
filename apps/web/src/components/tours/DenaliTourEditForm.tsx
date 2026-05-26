"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Alert, Button, Card, CardBody } from "@tour/ui";

import type { TourDetailDto } from "@/lib/services/tours.service";
import type { DenaliTourEditPatchIntent } from "@/features/tours/edit/updateTourDtoFromDenaliWizardForm";
import { transformTourToDenaliWizardValues } from "@/features/tours/clone/transformTourToDenaliWizardValues";
import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import {
  DenaliBasicInfoStep,
  DenaliLogisticsStep,
  DenaliPricingStep,
  DenaliProgramNatureStep,
} from "@/features/tours/wizard/denali";
import { DenaliPhotosStep } from "@/features/tours/wizard/denali/steps/DenaliPhotosStep";
import {
  getDenaliStepTitleFa,
  type DenaliCreateWizardStepId,
} from "@/features/tours/wizard/denaliStepConfig";
import { formatWizardApiErrorMessage } from "@/features/tours/wizard/format-wizard-api-error";
import { QuickAddModalProvider } from "@/components/shared/QuickAddModal";
import styles from "./DenaliTourEditForm.module.css";

type EditStepId = Exclude<DenaliCreateWizardStepId, "review">;
const EDIT_STEPS: readonly EditStepId[] = [
  "denali_basic",
  "denali_program",
  "denali_logistics",
  "denali_pricing",
  "denali_photos",
];

function DenaliStepBody({ stepId }: { stepId: EditStepId }) {
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
  }
  return body;
}

function mergeDefaults(
  defaults: DenaliCreateTourWizardForm,
  patch: Partial<DenaliCreateTourWizardForm>,
): DenaliCreateTourWizardForm {
  return {
    ...defaults,
    ...patch,
    basicInfo: { ...defaults.basicInfo, ...patch.basicInfo },
    programNature: { ...defaults.programNature, ...patch.programNature },
    transport: { ...defaults.transport, ...patch.transport },
    pricingPayment: { ...defaults.pricingPayment, ...patch.pricingPayment },
    participantRequirements: { ...defaults.participantRequirements, ...patch.participantRequirements },
    policies: { ...defaults.policies, ...patch.policies },
    photosData: { ...defaults.photosData, ...patch.photosData },
    tripDetails: {
      ...defaults.tripDetails,
      ...patch.tripDetails,
      logistics: { ...defaults.tripDetails.logistics, ...patch.tripDetails?.logistics },
    },
  };
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

export function DenaliTourEditForm({ tour, onCancel, onSubmit, submitError }: DenaliTourEditFormProps) {
  const t = useTranslations("tours.denali");
  const tForm = useTranslations("tours.form");
  const [currentStep, setCurrentStep] = useState(0);

  const initialValues = useMemo(() => {
    const defaults = buildDenaliTourCreateDefaultValues();
    const patch = transformTourToDenaliWizardValues(tour as TourCloneSourceDto, { mode: "clone" });
    return mergeDefaults(defaults, patch);
  }, [tour]);

  const formMethods = useForm<DenaliCreateTourWizardForm>({ defaultValues: initialValues, mode: "onTouched" });
  const { handleSubmit, formState } = formMethods;
  useWatch({ control: formMethods.control, name: "basicInfo.tourType" });

  const stepId = EDIT_STEPS[currentStep] ?? "denali_basic";
  const errorText = submitError ? formatWizardApiErrorMessage(submitError, tForm("saveFailed")) : null;

  return (
    <QuickAddModalProvider>
      <FormProvider {...formMethods}>
      <Card data-testid="denali-edit-tour-form" title={t("edit.pageTitle")} description={t("edit.pageDescription")}>
        <CardBody>
          <form
            className={styles.inner}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit(async (values) => {
                await onSubmit(values, { intent: "save" });
              })();
            }}
          >
            <ol style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", listStyle: "none", padding: 0, margin: 0 }}>
              {EDIT_STEPS.map((id, index) => (
                <li key={id} data-active={index === currentStep ? "true" : "false"}>
                  {index + 1}. {getDenaliStepTitleFa(id)}
                </li>
              ))}
            </ol>

            <DenaliStepBody stepId={stepId} />

            {errorText ? (
              <Alert variant="error" title={tForm("saveFailed")}>
                {errorText}
              </Alert>
            ) : null}

            <div className={styles.actions}>
              <Button type="button" variant="ghost" onClick={onCancel} disabled={formState.isSubmitting}>
                {tForm("cancel")}
              </Button>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={formState.isSubmitting || currentStep === 0}
                  onClick={() => setCurrentStep((v) => Math.max(0, v - 1))}
                >
                  {tForm("previous")}
                </Button>
                {currentStep < EDIT_STEPS.length - 1 ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={formState.isSubmitting}
                    onClick={() => setCurrentStep((v) => Math.min(EDIT_STEPS.length - 1, v + 1))}
                  >
                    {tForm("next")}
                  </Button>
                ) : (
                  <Button type="submit" variant="primary" disabled={formState.isSubmitting}>
                    {formState.isSubmitting ? tForm("saving") : tForm("saveChanges")}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardBody>
      </Card>
    </FormProvider>
    </QuickAddModalProvider>
  );
}
