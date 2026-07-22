/** Wizard clear-draft orchestration — testable sequence used by the hook. */
export async function runWizardClearDraftSequence<T>(options: {
  readonly clearDraftAndReset: (reset: T) => Promise<void>;
  readonly buildResetEnvelope: () => T;
  readonly onAfterClear?: () => void;
}): Promise<void> {
  await options.clearDraftAndReset(options.buildResetEnvelope());
  options.onAfterClear?.();
}
