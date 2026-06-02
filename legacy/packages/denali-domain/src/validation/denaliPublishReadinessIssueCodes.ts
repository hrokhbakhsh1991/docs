import type { DenaliWizardPublishReadinessIssue } from "./publishReadinessTypes";
import { resolvePublishReadinessFormPath } from "./publishReadinessPathResolver";

/**
 * Publish-readiness issue codes emitted by {@link ./denaliWizardPublishReadiness.ts}.
 * Excludes sync/banner-only codes outside this module.
 */
export const DENALI_PUBLISH_READINESS_BLOCKING_CODES = [
  "VALIDATION_RULE_REQUIRED_FIELD",
  "DENALI_TOUR_TYPE_REQUIRED",
  "DENALI_PUBLISH_PAYLOAD_UNBUILDABLE",
  "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
] as const;

export type DenaliPublishReadinessBlockingCode =
  (typeof DENALI_PUBLISH_READINESS_BLOCKING_CODES)[number];

/** Representative fixtures per code — used by path-coverage guard tests. */
export const DENALI_PUBLISH_READINESS_PATH_FIXTURES: Readonly<
  Record<DenaliPublishReadinessBlockingCode, readonly DenaliWizardPublishReadinessIssue[]>
> = {
  VALIDATION_RULE_REQUIRED_FIELD: [
    {
      code: "VALIDATION_RULE_REQUIRED_FIELD",
      message: "این فیلد الزامی است.",
      path: "basicInfo.capacityMax",
    },
  ],
  DENALI_TOUR_TYPE_REQUIRED: [
    {
      code: "DENALI_TOUR_TYPE_REQUIRED",
      message: "نوع تور را انتخاب کنید.",
      path: "basicInfo.tourType",
    },
  ],
  DENALI_PUBLISH_PAYLOAD_UNBUILDABLE: [
    {
      code: "DENALI_PUBLISH_PAYLOAD_UNBUILDABLE",
      message: "فرم هنوز برای ساخت درخواست انتشار کامل نیست.",
    },
    {
      code: "DENALI_PUBLISH_PAYLOAD_UNBUILDABLE",
      message: "فرم هنوز برای ساخت درخواست انتشار کامل نیست.",
      path: "basicInfo.publishStatus",
    },
  ],
  OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES: [
    {
      code: "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
      message:
        "logistics.gatheringPoints must include at least one station for denali_pilot publish.",
    },
    {
      code: "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
      message: "حداقل یک نقطه تجمع با آدرس و مختصات جغرافیایی لازم است.",
      path: "tripDetails.logistics.gatheringPoints",
    },
    {
      code: "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
      message:
        "overview.startPoint must include non-empty addressText and finite latitude/longitude for denali_pilot publish.",
    },
    {
      code: "OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES",
      message: "نقطه شروع باید آدرس و مختصات جغرافیایی داشته باشد.",
      path: "basicInfo.startPoint",
    },
  ],
};

export function publishReadinessIssueHasResolvablePath(
  issue: DenaliWizardPublishReadinessIssue,
): boolean {
  return resolvePublishReadinessFormPath(issue).length > 0;
}
