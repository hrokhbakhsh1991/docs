export type DenaliCreateTourWizardScreen =
  | "gate-loading"
  | "clone-loading"
  | "clone-error"
  | "not-configured"
  | "draft-loading"
  | "ready";

export type TourCloneHydrateStatus = "idle" | "loading" | "ready" | "error";

export function resolveDenaliCreateTourWizardScreen(input: {
  readonly gateLoading: boolean;
  readonly integrationRuntimeLoading?: boolean;
  readonly gatePublished: boolean;
  readonly cloneTourId: string | null;
  readonly cloneStatus: TourCloneHydrateStatus;
  readonly denaliDraftReady: boolean;
}): DenaliCreateTourWizardScreen {
  if (
    input.gateLoading ||
    input.integrationRuntimeLoading === true ||
    (input.cloneTourId !== null && input.cloneStatus === "loading")
  ) {
    return input.cloneTourId !== null && input.cloneStatus === "loading"
      ? "clone-loading"
      : "gate-loading";
  }
  if (input.cloneTourId !== null && input.cloneStatus === "error") {
    return "clone-error";
  }
  if (!input.gatePublished) {
    return "not-configured";
  }
  if (!input.denaliDraftReady) {
    return "draft-loading";
  }
  return "ready";
}

export const DENALI_CREATE_TOUR_CLONE_TEST_IDS = {
  loading: "operator-tour-clone-loading",
  error: "operator-tour-clone-error",
  photoRemintWarning: "operator-tour-clone-photo-remint-warning",
} as const;
