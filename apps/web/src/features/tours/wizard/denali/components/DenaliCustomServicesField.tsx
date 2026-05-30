"use client";

import { useCallback, useMemo } from "react";
import { type FieldArrayPath, useFieldArray, useFormContext } from "react-hook-form";

import type { TourFormProfile } from "@repo/types";

import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliLogistics.schema";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";

import { evaluateDenaliContextualVisibility } from "../application";
import {
  DENALI_CUSTOM_SERVICE_LABELS_PATH,
  type DenaliCustomServiceLabelsPath,
} from "../denaliCustomServiceLabelsPath";
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
  const handleAppend = useCallback(
    (label: string) => {
      append(label as never);
    },
    [append],
  );

  if (!isVisible) {
    return null;
  }

  return (
    <DenaliCustomServicesEditor
      control={control}
      name={DENALI_CUSTOM_SERVICE_LABELS_PATH as DenaliCustomServiceLabelsPath}
      fields={fields}
      onAppend={handleAppend}
      onRemove={remove}
    />
  );
}
