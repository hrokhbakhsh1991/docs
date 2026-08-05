/**
 * INV-DENALI-WIZ-015 — step-nav validation summary must survive draft identity churn
 * when canonical `data` is unchanged (remote merge / prepareEnvelope remint).
 */
export function stableWizardDraftDataKey(draft: {
  readonly data?: unknown;
}): string {
  try {
    return JSON.stringify(draft.data ?? null);
  } catch {
    return "";
  }
}

/**
 * True when step-nav issues should be dismissed after a draft update.
 * Same-payload remints return false; first observation (no previous key) returns false.
 */
export function shouldClearStepNavValidationOnDraftChange(input: {
  readonly previousDataKey: string | null;
  readonly nextDataKey: string;
  readonly issueCount: number;
}): boolean {
  if (input.issueCount <= 0) {
    return false;
  }
  if (input.previousDataKey == null) {
    return false;
  }
  return input.previousDataKey !== input.nextDataKey;
}
