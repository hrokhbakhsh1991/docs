import type { TourFormProfile } from "@repo/types";
import { z } from "zod";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";
import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { stripTenantGatedTourCreateGroups } from "@/features/tours/contracts/tenant-tour-form-contract";
import { stripInactiveTourCreateGroupsForProfile } from "@/features/tours/wizard/fieldGroups";
import { wizardFormToCreateTourApiPayload } from "@/features/tours/wizard/contract/tour-wizard-contract";
import type { CreateTourDto } from "@/lib/services/tours.service";
import { createTour } from "@/lib/services/tours.service";
import { getWizardSubmitIdempotencyKey } from "@/features/tours/wizard/wizardSubmitSession";

import { mapDenaliWizardToCreateTourPayload } from "./mapDenaliWizardToCreateTourPayload";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliTourCreateSchema";
import { normalizeDenaliWizardForm } from "../schemas/denaliTourCreateFormModel";
import { getDenaliWizardSubmitIssues } from "../denali/validation/denaliWizardFormZod";

export type WizardThemeCatalogRow = readonly { id: string; name: string }[];

/**
 * Classic 9-step wizard → API (used by {@link useTourWizardCreate}).
 */
export async function createTourFromClassicWizardForm(input: {
  values: TourCreateFormValues;
  /** Workspace template profile — client strip only; not sent on POST (server resolves from template). */
  workspaceFormProfile: TourFormProfile;
  themeCatalog?: WizardThemeCatalogRow;
  tenantFormContract?: TenantTourFormContract;
  sourcePresetId?: string;
  sourceTourId?: string;
}): Promise<unknown> {
  let stripped = stripInactiveTourCreateGroupsForProfile(input.workspaceFormProfile, input.values);
  if (input.tenantFormContract) {
    stripped = stripTenantGatedTourCreateGroups(input.tenantFormContract, stripped);
  }
  const dto = wizardFormToCreateTourApiPayload(input.workspaceFormProfile, stripped);
  return createTour(
    mapCreateTourDto(
      { ...dto, sourcePresetId: input.sourcePresetId, sourceTourId: input.sourceTourId },
      { themeCatalog: input.themeCatalog },
    ),
    { idempotencyKey: getWizardSubmitIdempotencyKey() },
  );
}

/**
 * Workspace-specific 6-tab wizard → API (used by {@link useDenaliTourWizardCreate}).
 * Submit validation: {@link getDenaliWizardSubmitIssues} (structural + rules + canonical).
 */
export async function createTourFromWorkspaceWizardForm(input: {
  values: DenaliCreateTourWizardForm;
  /** Workspace template profile — client strip only; not sent on POST (server resolves from template). */
  workspaceFormProfile: TourFormProfile;
  themeCatalog?: WizardThemeCatalogRow;
  sourcePresetId?: string;
  sourceTourId?: string;
}): Promise<unknown> {
  const normalized = normalizeDenaliWizardForm(input.values);
  const submitIssues = getDenaliWizardSubmitIssues(normalized);
  if (submitIssues.length > 0) {
    throw new z.ZodError(submitIssues);
  }
  let dto: CreateTourDto = mapDenaliWizardToCreateTourPayload(normalized);
  dto = stripCreateTourDtoForFormProfile(input.workspaceFormProfile, dto);
  return createTour(
    mapCreateTourDto(
      { ...dto, sourcePresetId: input.sourcePresetId, sourceTourId: input.sourceTourId },
      { themeCatalog: input.themeCatalog },
    ),
    { idempotencyKey: getWizardSubmitIdempotencyKey() },
  );
}
