import type { TourFormProfile } from "@repo/types";
import { z } from "zod";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";
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
import type { DenaliRuleSet } from "../denali/rules/denaliRuleModel";
import { prepareDenaliWizardFormForSubmit } from "../denali/validation/denaliRuleAccess";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { evaluateDenaliWizardSubmitGate } from "../denali/validation/denaliSubmitValidation";
import { mergeDenaliActiveSubmitIssues } from "../denali/validation/denaliSubmitValidation";

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
  workspaceId?: string;
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
    { idempotencyKey: getWizardSubmitIdempotencyKey(input.workspaceId) },
  );
}

/**
 * Workspace-specific 6-tab wizard → API (used by {@link useDenaliTourWizardCreate}).
 * Submit validation: {@link evaluateDenaliWizardSubmitGate} (active only — structural + rules + canonical + publish).
 */
export async function createTourFromWorkspaceWizardForm(input: {
  values: DenaliCreateTourWizardForm;
  ruleSet: DenaliRuleSet;
  /** Workspace template profile — client strip only; not sent on POST (server resolves from template). */
  workspaceFormProfile: TourFormProfile;
  themeCatalog?: WizardThemeCatalogRow;
  workspaceId?: string;
  sourcePresetId?: string;
  sourceTourId?: string;
  /** Gallery staging shell to finalize instead of creating a duplicate tour row. */
  stagingTourId?: string;
}): Promise<unknown> {
  const normalized = prepareDenaliWizardFormForSubmit(input.values, input.ruleSet);
  const gate = evaluateDenaliWizardSubmitGate(normalized, {
    ruleSet: input.ruleSet,
    profile: input.workspaceFormProfile,
  });
  const blockingIssues = mergeDenaliActiveSubmitIssues(gate.submitIssues, gate.publishIssues);
  if (!gate.success) {
    throw new z.ZodError(blockingIssues);
  }
  let dto: CreateTourDto = mapDenaliWizardToCreateTourPayload(normalized);
  dto = stripCreateTourDtoForFormProfile(input.workspaceFormProfile, dto);
  const mapped = mapCreateTourDto(
    { ...dto, sourcePresetId: input.sourcePresetId, sourceTourId: input.sourceTourId },
    { themeCatalog: input.themeCatalog },
  );
  if (input.stagingTourId?.trim()) {
    mapped.stagingTourId = input.stagingTourId.trim();
  }
  return createTour(mapped, { idempotencyKey: getWizardSubmitIdempotencyKey(input.workspaceId) });
}
