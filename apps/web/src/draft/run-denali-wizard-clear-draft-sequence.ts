/** Denali wizard clear-draft orchestration — testable sequence used by the hook. */
export async function runDenaliWizardClearDraftSequence<T>(options: {
  readonly clearDraftAndReset: (reset: T) => Promise<void>;
  readonly buildResetEnvelope: () => T;
  readonly onAfterClear?: () => void;
}): Promise<void> {
  await options.clearDraftAndReset(options.buildResetEnvelope());
  options.onAfterClear?.();
}
