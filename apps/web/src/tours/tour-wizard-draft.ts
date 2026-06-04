export type TourWizardDraft = {
  readonly data: {
    readonly basics?: { readonly title?: string; readonly featured?: string };
    readonly details?: { readonly summary?: string; readonly status?: string };
  };
};

export const emptyTourWizardDraft = (): TourWizardDraft => ({
  data: {
    basics: { title: "", featured: "false" },
    details: { summary: "", status: "draft" },
  },
});

export function tourWizardDraftToPayload(draft: TourWizardDraft) {
  return {
    data: draft.data,
  };
}
