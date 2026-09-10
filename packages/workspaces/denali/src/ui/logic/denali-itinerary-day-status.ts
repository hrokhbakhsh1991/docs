import {
  collectDenaliItineraryDayValidationIssues,
  dayHasRequiredItineraryContent,
  type DenaliItineraryDay,
} from "../../schemas/denaliItineraryDaySchema";

export type DenaliItineraryDayStatus = "complete" | "incomplete" | "error";

export function resolveDenaliItineraryDayStatuses(
  days: readonly DenaliItineraryDay[],
  options?: { readonly showValidationErrors?: boolean }
): readonly DenaliItineraryDayStatus[] {
  const showValidationErrors = options?.showValidationErrors === true;
  const errorDayIndexes = new Set<number>();
  if (showValidationErrors) {
    for (const issue of collectDenaliItineraryDayValidationIssues(days)) {
      errorDayIndexes.add(issue.dayIndex);
    }
  }

  return days.map((day, dayIndex) => {
    if (errorDayIndexes.has(dayIndex)) {
      return "error";
    }
    return dayHasRequiredItineraryContent(day) ? "complete" : "incomplete";
  });
}

export function findFirstDenaliItineraryDayIssueIndex(
  days: readonly DenaliItineraryDay[]
): number | null {
  const issues = collectDenaliItineraryDayValidationIssues(days);
  if (issues.length === 0) {
    return null;
  }
  return issues[0]?.dayIndex ?? null;
}
