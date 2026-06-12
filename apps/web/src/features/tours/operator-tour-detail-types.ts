import type { TourListProjection } from "./operator-tours-types";

export const TOUR_EDIT_TEST_IDS = {
  page: "operator-tour-edit-page",
  title: "operator-tour-edit-title",
  save: "operator-tour-edit-save",
  retry: "operator-tour-edit-retry",
  workspace: "operator-tour-edit-workspace",
  register: "operator-tour-edit-register",
  flatForm: "operator-tour-edit-flat-form",
  flatSection: (stepId: string) => `operator-tour-edit-section-${stepId}`,
  publish: "operator-tour-edit-publish",
  unpublish: "operator-tour-edit-unpublish",
  cancel: "operator-tour-edit-cancel",
  draftSync: "operator-tour-edit-draft-sync",
} as const;

export type OperatorTourDetailResponse = {
  readonly id: string;
  readonly tenantId: string;
  readonly rowVersion: number;
  readonly canonical: {
    readonly data: Record<string, unknown>;
    readonly schemaVersion?: number;
  };
  readonly projection: TourListProjection;
};

export type TourTitlePatchBody = {
  readonly rowVersion: number;
  readonly roots: readonly string[];
  readonly data: Record<string, unknown>;
};
