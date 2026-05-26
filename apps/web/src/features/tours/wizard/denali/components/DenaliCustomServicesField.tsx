"use client";

import { useMemo } from "react";
import { type FieldArrayPath, useFieldArray, useFormContext, useWatch } from "react-hook-form";

import type { TourFormProfile } from "@repo/types";

import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";

import { evaluateDenaliContextualVisibility } from "../rules/denaliUIAdapter";
import { DENALI_CUSTOM_SERVICE_LABELS_PATH } from "../denaliCustomServiceLabelsPath";
import { DenaliCustomServicesEditor } from "./DenaliCustomServicesEditor";

export { DENALI_CUSTOM_SERVICE_LABELS_PATH };

export function DenaliCustomServicesField({
  workspaceFormProfile: workspaceFormProfileProp,
}: {
  workspaceFormProfile?: TourFormProfile;
}) {
  const wizardTemplateQuery = useTenantWizardTemplate();
  const workspaceFormProfile = useMemo(
    () =>
      workspaceFormProfileProp ??
      resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data),
    [workspaceFormProfileProp, wizardTemplateQuery.data],
  );
  const { control, getValues } = useFormContext<DenaliCreateTourWizardForm>();
  const isVisible = evaluateDenaliContextualVisibility(
    "tripDetails.overview.customServiceLabels",
    getValues(),
    { workspaceFormProfile },
  );
  const { fields, append, remove } = useFieldArray({
    control,
    name: DENALI_CUSTOM_SERVICE_LABELS_PATH as FieldArrayPath<DenaliCreateTourWizardForm>,
  });
  const labels =
    useWatch({
      control,
      name: DENALI_CUSTOM_SERVICE_LABELS_PATH,
    }) ?? [];

  if (!isVisible) {
    return null;
  }

  return (
    <DenaliCustomServicesEditor
      fields={fields}
      labels={labels}
      onAppend={(label) => append(label as never)}
      onRemove={remove}
    />
  );
}
