/**
 * Client-side OPEN/publish gate parity with API
 * {@link ../../../../../../../api/src/modules/tours/policies/assert-tour-publish-transition.ts}
 * (`assertProfileRequiredFieldsForPublish` + `checkDenaliPilotPublishGeolocationZones`).
 */

import {
  checkDenaliPilotPublishGeolocationZones,
  type WorkspaceInvariantViolation,
} from "@repo/shared-contracts";
import {
  getRequiredSubmitFieldPathsForProfile,
  type TourFormProfile,
  type TourTripDetails,
  type WizardSubmitRequiredFieldPath,
} from "@repo/types";

import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import type { CreateTourDto } from "@/lib/services/tours.service";

import { mapDenaliWizardToCreateTourPayload } from "../../domain/mapDenaliWizardToCreateTourPayload";
import { normalizeDenaliWizardForm } from "../../schemas/denaliTourCreateFormModel";
import type { DenaliCreateTourWizardForm } from "../../schemas/denaliTourCreateSchema";

export type DenaliWizardPublishReadinessIssue = {
  code: string;
  message: string;
  path?: WizardSubmitRequiredFieldPath;
};

/** Mirrors API `ProfileRequiredSubmitShape` / `readDtoValueForWizardPath`. */
type ProfileRequiredSubmitShape = {
  title: string;
  cost_context?: { totalCost?: number | null } | null;
  tripDetails?: CreateTourDto["tripDetails"] | null;
};

const PUBLISH_REQUIRED_MESSAGES: Readonly<Record<WizardSubmitRequiredFieldPath, string>> = {
  "overview.title": "عنوان تور را وارد کنید.",
  "pricing.basePrice": "قیمت تور را وارد کنید.",
  "itinerary.days": "حداقل یک روز برای برنامه سفر تعریف کنید.",
  "logistics.primaryTransportMode": "حمل‌ونقل اصلی سفر را انتخاب کنید.",
};

function isEmptyRequiredValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "number") {
    return Number.isNaN(value);
  }
  return false;
}

function readDtoValueForWizardPath(
  dto: ProfileRequiredSubmitShape,
  path: WizardSubmitRequiredFieldPath,
): unknown {
  switch (path) {
    case "overview.title":
      return dto.title;
    case "pricing.basePrice":
      return dto.cost_context?.totalCost;
    case "itinerary.days": {
      const itinerary = dto.tripDetails?.itinerary as
        | {
            segmentActivities?: unknown[];
            dayPlans?: unknown[];
          }
        | undefined;
      if (itinerary == null) {
        return [];
      }
      const segmentActivities = itinerary.segmentActivities;
      if (Array.isArray(segmentActivities) && segmentActivities.length > 0) {
        return segmentActivities;
      }
      const dayPlans = itinerary.dayPlans;
      if (Array.isArray(dayPlans) && dayPlans.length > 0) {
        return dayPlans;
      }
      return [];
    }
    case "logistics.primaryTransportMode": {
      const logistics = dto.tripDetails?.logistics as
        | { primaryTransportMode?: string | null }
        | undefined;
      return logistics?.primaryTransportMode;
    }
    default: {
      const _exhaustive: never = path;
      return _exhaustive;
    }
  }
}

function createTourDtoToProfileRequiredSubmitShape(dto: CreateTourDto): ProfileRequiredSubmitShape {
  const totalCost =
    typeof dto.price === "number" && Number.isFinite(dto.price) ? dto.price : undefined;
  return {
    title: dto.title,
    cost_context: totalCost !== undefined ? { totalCost } : undefined,
    tripDetails: dto.tripDetails,
  };
}

function geoViolationMessage(violation: WorkspaceInvariantViolation): string {
  if (violation.message.includes("startPoint")) {
    return "نقطه شروع باید آدرس و مختصات جغرافیایی داشته باشد.";
  }
  if (violation.message.includes("gatheringPoints")) {
    return "حداقل یک نقطه تجمع با آدرس و مختصات جغرافیایی لازم است.";
  }
  return "مختصات جغرافیایی نقاط تجمع و شروع برای انتشار الزامی است.";
}

function collectProfileRequiredFieldIssues(
  profile: TourFormProfile,
  shape: ProfileRequiredSubmitShape,
): DenaliWizardPublishReadinessIssue[] {
  const issues: DenaliWizardPublishReadinessIssue[] = [];
  for (const path of getRequiredSubmitFieldPathsForProfile(profile)) {
    if (isEmptyRequiredValue(readDtoValueForWizardPath(shape, path))) {
      issues.push({
        code: "VALIDATION_PROFILE_REQUIRED_FIELD",
        path,
        message: PUBLISH_REQUIRED_MESSAGES[path],
      });
    }
  }
  return issues;
}

/**
 * OPEN publish readiness for Denali wizard (only when `publishStatus === "active"`).
 * Returns empty when the user chose draft — API skips publish asserts for Draft lifecycle.
 */
export function getDenaliWizardPublishReadinessIssues(
  rawForm: DenaliCreateTourWizardForm,
  profile: TourFormProfile = "denali_pilot",
): DenaliWizardPublishReadinessIssue[] {
  const form = normalizeDenaliWizardForm(rawForm);
  if (form.basicInfo.publishStatus !== "active") {
    return [];
  }

  let dto: CreateTourDto;
  try {
    dto = stripCreateTourDtoForFormProfile(profile, mapDenaliWizardToCreateTourPayload(form));
  } catch {
    return [
      {
        code: "DENALI_PUBLISH_PAYLOAD_UNBUILDABLE",
        message: "فرم هنوز برای ساخت درخواست انتشار کامل نیست.",
      },
    ];
  }

  const issues: DenaliWizardPublishReadinessIssue[] = [];

  if (profile === "denali_pilot") {
    const geoViolation = checkDenaliPilotPublishGeolocationZones(
      (dto.tripDetails ?? null) as TourTripDetails | null,
    );
    if (geoViolation != null) {
      issues.push({
        code: geoViolation.code,
        message: geoViolationMessage(geoViolation),
      });
    }
  }

  issues.push(
    ...collectProfileRequiredFieldIssues(
      profile,
      createTourDtoToProfileRequiredSubmitShape(dto),
    ),
  );

  return issues;
}

export function isDenaliWizardReadyForOpenPublish(
  form: DenaliCreateTourWizardForm,
  profile: TourFormProfile = "denali_pilot",
): boolean {
  return getDenaliWizardPublishReadinessIssues(form, profile).length === 0;
}
