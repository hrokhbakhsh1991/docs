import type { DenaliWizardDraftEnvelope, DenaliWizardDraftMeta } from "../../draft/denali-wizard-draft-binding";
import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";

export function buildDenaliWizardStepChangeEnvelope<TForm>(
  envelope: DenaliWizardDraftEnvelope<TForm> | null,
  nextStepIndex: number,
  prepareEnvelope: (form: TForm, meta: DenaliWizardDraftMeta) => DenaliWizardDraftEnvelope<TForm>
): DenaliWizardDraftEnvelope<TForm> | null {
  if (envelope === null || envelope.meta.currentStepIndex === nextStepIndex) {
    return null;
  }
  const nextMeta = { ...envelope.meta };
  if (nextStepIndex > 0) {
    delete nextMeta.freshStart;
  }
  return prepareEnvelope(envelope.form, {
    ...nextMeta,
    currentStepIndex: nextStepIndex,
  });
}

/** Step navigation must read the latest envelope ref — not a render closure — so field edits are not dropped. */
export function buildDenaliWizardStepChangeFromLatestRef<TForm extends DenaliTourWizardDraft>(
  getEnvelope: () => DenaliWizardDraftEnvelope<TForm> | null,
  nextStepIndex: number,
  prepareEnvelope: (
    form: TForm,
    meta: DenaliWizardDraftMeta
  ) => DenaliWizardDraftEnvelope<TForm>
): DenaliWizardDraftEnvelope<TForm> | null {
  return buildDenaliWizardStepChangeEnvelope(getEnvelope(), nextStepIndex, prepareEnvelope);
}
