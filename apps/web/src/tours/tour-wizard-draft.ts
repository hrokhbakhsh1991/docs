export type TourWizardDraft = {
  readonly data: {
    readonly basics?: { readonly title?: string };
    readonly details?: { readonly summary?: string };
  };
};

export const emptyTourWizardDraft = (): TourWizardDraft => ({
  data: {
    basics: { title: "" },
    details: { summary: "" },
  },
});

export function tourWizardDraftToPayload(draft: TourWizardDraft) {
  return {
    data: draft.data,
  };
}
