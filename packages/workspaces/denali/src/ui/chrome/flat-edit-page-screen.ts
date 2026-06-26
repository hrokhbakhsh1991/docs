export type DenaliFlatEditPageScreen =
  | "gate-loading"
  | "tour-loading"
  | "not-configured"
  | "not-found"
  | "ready";

export function resolveDenaliFlatEditPageScreen(input: {
  readonly gateLoading: boolean;
  readonly integrationRuntimeLoading?: boolean;
  readonly gatePublished: boolean;
  readonly tourLoading: boolean;
  readonly formReady: boolean;
  readonly error: string | null;
  readonly hasDetail: boolean;
}): DenaliFlatEditPageScreen {
  if (
    input.gateLoading ||
    input.integrationRuntimeLoading === true ||
    (input.gatePublished && input.tourLoading)
  ) {
    return input.gatePublished && input.tourLoading ? "tour-loading" : "gate-loading";
  }
  if (!input.gatePublished) {
    return "not-configured";
  }
  if (input.error === "TOUR_NOT_FOUND" || !input.hasDetail) {
    return "not-found";
  }
  if (!input.formReady) {
    return "tour-loading";
  }
  return "ready";
}
