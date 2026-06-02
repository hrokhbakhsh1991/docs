/** Minimal fields needed to resolve an RHF path for review navigation. */
export type PublishReadinessResolvableIssue = {
  code: string;
  message: string;
  path?: string;
};

/** RHF path for review navigation when publish readiness issues omit `path`. */
export function resolvePublishReadinessFormPath(
  issue: PublishReadinessResolvableIssue,
): string {
  if (issue.path != null && issue.path.length > 0) {
    return issue.path;
  }
  if (issue.code === "DENALI_PUBLISH_PAYLOAD_UNBUILDABLE") {
    return "basicInfo.publishStatus";
  }
  const message = issue.message;
  if (message.includes("logistics.gatheringPoints") || message.includes("gatheringPoints")) {
    return "tripDetails.logistics.gatheringPoints";
  }
  if (message.includes("overview.startPoint") || message.includes("startPoint")) {
    return "basicInfo.startPoint";
  }
  return "";
}
