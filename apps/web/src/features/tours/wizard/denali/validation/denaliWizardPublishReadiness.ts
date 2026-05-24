/**
 * Client-side OPEN/publish gate parity with API
 * {@link ../../../../../../../api/src/modules/tours/policies/assert-tour-publish-transition.ts}
 * (`assertProfileRequiredFieldsForPublish` + `checkDenaliPilotPublishGeolocationZones`).
 *
 * Required fields: {@link ../rules/denaliRuleRequired.ts} (`collectDenaliRuleRequiredIssues`).
 */

import {
  checkDenaliPilotPublishGeolocationZones,
  type WorkspaceInvariantViolation,
} from "@repo/shared-contracts";
import type { TourFormProfile, TourTripDetails, WizardSubmitRequiredFieldPath } from "@repo/types";

import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import type { CreateTourDto } from "@/lib/services/tours.service";

import { mapDenaliWizardToCreateTourPayload } from "../../domain/mapDenaliWizardToCreateTourPayload";
import { normalizeDenaliWizardForm } from "../../schemas/denaliTourCreateFormModel";
import type { DenaliCreateTourWizardForm } from "../../schemas/denaliTourCreateSchema";
import {
  collectDenaliRuleRequiredIssues,
  type DenaliRuleRequiredIssue,
} from "../rules/denaliRuleRequired";
import { resolveDenaliRuleModelFromForm } from "./denaliRuleAccess";

export type DenaliWizardPublishReadinessIssue = {
  code: string;
  message: string;
  path?: WizardSubmitRequiredFieldPath | string;
};

function geoViolationMessage(violation: WorkspaceInvariantViolation): string {
  if (violation.message.includes("startPoint")) {
    return "نقطه شروع باید آدرس و مختصات جغرافیایی داشته باشد.";
  }
  if (violation.message.includes("gatheringPoints")) {
    return "حداقل یک نقطه تجمع با آدرس و مختصات جغرافیایی لازم است.";
  }
  return "مختصات جغرافیایی نقاط تجمع و شروع برای انتشار الزامی است.";
}

function ruleRequiredIssueToPublishIssue(issue: DenaliRuleRequiredIssue): DenaliWizardPublishReadinessIssue {
  return {
    code: "VALIDATION_RULE_REQUIRED_FIELD",
    message: issue.message,
    path: issue.path.join("."),
  };
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

  const model = resolveDenaliRuleModelFromForm(form);
  if (model == null) {
    return [
      {
        code: "DENALI_TOUR_TYPE_REQUIRED",
        message: "نوع تور را انتخاب کنید.",
        path: "basicInfo.tourType",
      },
    ];
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

  const issues: DenaliWizardPublishReadinessIssue[] = collectDenaliRuleRequiredIssues(form, model, {
    mode: "submit",
  }).map(ruleRequiredIssueToPublishIssue);

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

  return issues;
}

export function isDenaliWizardReadyForOpenPublish(
  form: DenaliCreateTourWizardForm,
  profile: TourFormProfile = "denali_pilot",
): boolean {
  return getDenaliWizardPublishReadinessIssues(form, profile).length === 0;
}
