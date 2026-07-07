import type { ValidationIssue } from "@app-tour/wizard-navigation";

export type ValidationIssueStepGroup = {
  readonly stepId: string;
  readonly label: string;
  readonly issues: readonly ValidationIssue[];
};

export function groupValidationIssuesByStep(
  issues: readonly ValidationIssue[],
  steps: readonly { readonly stepId: string; readonly label: string }[]
): readonly ValidationIssueStepGroup[] {
  const groups = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    const stepId = issue.stepId ?? "unknown";
    const bucket = groups.get(stepId) ?? [];
    bucket.push(issue);
    groups.set(stepId, bucket);
  }

  const ordered: ValidationIssueStepGroup[] = [];
  for (const step of steps) {
    const stepIssues = groups.get(step.stepId);
    if (stepIssues == null || stepIssues.length === 0) {
      continue;
    }
    ordered.push({
      stepId: step.stepId,
      label: step.label,
      issues: stepIssues,
    });
    groups.delete(step.stepId);
  }

  for (const [stepId, stepIssues] of groups) {
    if (stepIssues.length === 0) {
      continue;
    }
    ordered.push({
      stepId,
      label: stepId,
      issues: stepIssues,
    });
  }

  return ordered;
}
