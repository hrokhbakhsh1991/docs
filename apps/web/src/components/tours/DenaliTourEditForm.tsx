"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Alert, Button, Card, CardBody } from "@tour/ui";

import type { TourDetailDto } from "@/lib/services/tours.service";
import type { DenaliTourEditPatchIntent } from "@/features/tours/edit/updateTourDtoFromDenaliWizardForm";
import { transformTourToDenaliWizardValues } from "@/features/tours/clone/transformTourToDenaliWizardValues";
import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import {
  DenaliSection,
  type DenaliEditSectionId,
} from "@/features/tours/denali/fields/DenaliSection";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  DenaliCanonicalProvider,
  useDenaliCanonical,
} from "@/features/tours/wizard/denali/DenaliCanonicalContext";
import { useDenaliEditRuleSync } from "@/features/tours/wizard/denali/hooks/useDenaliEditRuleSync";
import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import { formatWizardApiErrorMessage } from "@/features/tours/wizard/format-wizard-api-error";
import { QuickAddModalProvider } from "@/components/shared/QuickAddModal";

import styles from "./DenaliTourEditForm.module.css";

const EDIT_SECTIONS: readonly DenaliEditSectionId[] = getDenaliWizardSteps().filter(
  (step): step is DenaliEditSectionId => step !== "review",
);

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
  onSubmit: (_values: DenaliCreateTourWizardForm, _meta: DenaliTourEditSubmitMeta) => Promise<void>;
  submitError?: unknown;
};

function DenaliEditFormInner({
  tourId,
  onCancel,
  onSubmit,
  errorText,
  formMethods,
  workspaceFormProfile,
  onRuleSynced,
}: {
  tourId: string;
  onCancel: () => void;
  onSubmit: DenaliTourEditFormProps["onSubmit"];
  errorText: string | null;
  formMethods: ReturnType<typeof useForm<DenaliCreateTourWizardForm>>;
  workspaceFormProfile: ReturnType<typeof resolveWorkspaceTourFormProfileFromTemplate>;
  onRuleSynced: () => void;
}) {
  const tForm = useTranslations("tours.form");
  const { ruleSet } = useDenaliCanonical();
  const { handleSubmit, formState } = formMethods;

  useDenaliEditRuleSync(formMethods, ruleSet, onRuleSynced, {
    workspaceFormProfile: workspaceFormProfile ?? undefined,
  });

  return (
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
      {EDIT_SECTIONS.map((sectionId) => (
        <DenaliSection key={sectionId} sectionId={sectionId} tourId={tourId} />
      ))}

      {errorText ? (
        <Alert variant="error" title={tForm("saveFailed")}>
          {errorText}
        </Alert>
      ) : null}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={formState.isSubmitting}>
          {tForm("cancel")}
        </Button>
        <Button type="submit" variant="primary" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? tForm("saving") : tForm("saveChanges")}
        </Button>
      </div>
    </form>
  );
}

export function DenaliTourEditForm({ tour, onCancel, onSubmit, submitError }: DenaliTourEditFormProps) {
  const t = useTranslations("tours.denali");
  const tForm = useTranslations("tours.form");
  const wizardTemplateQuery = useTenantWizardTemplate();
  const workspaceFormProfile = useMemo(
    () => resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data),
    [wizardTemplateQuery.data],
  );
  const [ruleSyncToken, setRuleSyncToken] = useState(0);

  const initialValues = useMemo(() => {
    const defaults = buildDenaliTourCreateDefaultValues();
    const patch = transformTourToDenaliWizardValues(tour as TourCloneSourceDto, { mode: "clone" });
    return mergeDefaults(defaults, patch);
  }, [tour]);

  const formMethods = useForm<DenaliCreateTourWizardForm>({ defaultValues: initialValues, mode: "onTouched" });

  const handleRuleSynced = useCallback(() => {
    setRuleSyncToken((token) => token + 1);
  }, []);

  const errorText = submitError ? formatWizardApiErrorMessage(submitError, tForm("saveFailed")) : null;

  return (
    <QuickAddModalProvider>
      <FormProvider {...formMethods}>
        <DenaliCanonicalProvider
          formMethods={formMethods}
          syncToken={ruleSyncToken}
          wizardTemplate={wizardTemplateQuery.data ?? null}
          uploadTourId={tour.id}
          workspaceFormProfile={workspaceFormProfile ?? undefined}
        >
          <Card
            data-testid="denali-edit-tour-form"
            title={t("edit.pageTitle")}
            description={t("edit.pageDescription")}
          >
            <CardBody>
              <DenaliEditFormInner
                tourId={tour.id}
                onCancel={onCancel}
                onSubmit={onSubmit}
                errorText={errorText}
                formMethods={formMethods}
                workspaceFormProfile={workspaceFormProfile}
                onRuleSynced={handleRuleSynced}
              />
            </CardBody>
          </Card>
        </DenaliCanonicalProvider>
      </FormProvider>
    </QuickAddModalProvider>
  );
}
