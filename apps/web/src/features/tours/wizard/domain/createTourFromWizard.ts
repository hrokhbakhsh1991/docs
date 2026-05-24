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
import { debugSessionLog, summarizeDenaliCreatePayload } from "@/lib/debug-session-log";

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
  debugSessionLog(
    "createTourFromWorkspaceWizardForm.ts:submit-gate",
    "Denali submit gate evaluated",
    {
      issueCount: submitIssues.length,
      issuePaths: submitIssues.slice(0, 8).map((i) => i.path?.join(".") ?? i.message),
      publishStatus: normalized.basicInfo.publishStatus,
      transportMode: normalized.transport.transportMode,
    },
    "C",
  );
  if (submitIssues.length > 0) {
    throw new z.ZodError(submitIssues);
  }
  let dto: CreateTourDto = mapDenaliWizardToCreateTourPayload(normalized);
  dto = stripCreateTourDtoForFormProfile(input.workspaceFormProfile, dto);
  debugSessionLog(
    "createTourFromWorkspaceWizardForm.ts:payload",
    "Denali create DTO built",
    summarizeDenaliCreatePayload(dto),
    "A",
  );
  debugSessionLog(
    "createTourFromWorkspaceWizardForm.ts:photos",
    "Denali photo URL scan",
    {
      galleryBlobCount: (normalized.photosData?.photos ?? []).filter((p) =>
        String(p?.url ?? "").startsWith("blob:"),
      ).length,
      galleryTotal: normalized.photosData?.photos?.length ?? 0,
    },
    "B",
  );
  try {
    return await createTour(
      mapCreateTourDto(
        { ...dto, sourcePresetId: input.sourcePresetId, sourceTourId: input.sourceTourId },
        { themeCatalog: input.themeCatalog },
      ),
      { idempotencyKey: getWizardSubmitIdempotencyKey() },
    );
  } catch (err) {
    debugSessionLog(
      "createTourFromWorkspaceWizardForm.ts:api-error",
      "Denali createTour failed",
      {
        errorName: err instanceof Error ? err.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode:
          err != null && typeof err === "object" && "code" in err
            ? String((err as { code: unknown }).code)
            : undefined,
        errorStatus:
          err != null && typeof err === "object" && "status" in err
            ? (err as { status: unknown }).status
            : undefined,
      },
      "E",
    );
    throw err;
  }
}
