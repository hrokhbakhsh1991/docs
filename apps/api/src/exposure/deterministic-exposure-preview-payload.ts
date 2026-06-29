/**
 * Fixed payloads for read-only exposure engine previews.
 * Keeps admin preview and control-plane views deterministic across requests.
 */
export const DETERMINISTIC_EXPOSURE_PREVIEW_PAYLOAD_BY_EVENT: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = {
  TourCreated: { status: "published", title: "Engine preview" },
  TourPublished: { status: "published", title: "Engine preview" },
};

export function resolveDeterministicExposurePreviewPayload(
  eventType: string,
): Readonly<Record<string, unknown>> {
  return DETERMINISTIC_EXPOSURE_PREVIEW_PAYLOAD_BY_EVENT[eventType] ?? { status: "published" };
}
