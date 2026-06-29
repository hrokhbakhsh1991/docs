import type { ExposureControlPlaneFieldDecision } from "./exposure-control-plane-client";

export type ExposureEnginePreviewResponse = {
  readonly samplePayload?: Readonly<Record<string, unknown>>;
  readonly fields: Readonly<Record<string, Omit<ExposureControlPlaneFieldDecision, "fieldId">>>;
  readonly summary: {
    readonly visibleCount: number;
    readonly hiddenCount: number;
    readonly blockedCount: number;
  };
};

export type ExposureEnginePreviewModel = {
  readonly samplePayload: Readonly<Record<string, unknown>>;
  readonly decisions: readonly ExposureControlPlaneFieldDecision[];
  readonly engineSelectedFieldIds: readonly string[];
};

const EXPOSURE_DECISION_STATES = new Set([
  "visible",
  "hidden",
  "redacted",
  "summary_only",
  "blocked",
]);

function parseFieldDecision(
  fieldId: string,
  payload: unknown,
): ExposureControlPlaneFieldDecision | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const state = record.state;
  if (typeof state !== "string" || !EXPOSURE_DECISION_STATES.has(state)) {
    return null;
  }
  return {
    fieldId,
    state: state as ExposureControlPlaneFieldDecision["state"],
    reasonChain: Array.isArray(record.reasonChain)
      ? record.reasonChain.filter((entry): entry is string => typeof entry === "string")
      : [],
    appliedPolicies: Array.isArray(record.appliedPolicies)
      ? record.appliedPolicies.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

export function parseExposureEnginePreviewResponse(
  payload: unknown,
): ExposureEnginePreviewModel {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("EXPOSURE_ENGINE_PREVIEW_INVALID");
  }
  const record = payload as Record<string, unknown>;
  const fieldsRaw =
    typeof record.fields === "object" && record.fields !== null
      ? (record.fields as Record<string, unknown>)
      : {};
  const decisions = Object.entries(fieldsRaw)
    .map(([fieldId, decision]) => parseFieldDecision(fieldId, decision))
    .filter((entry): entry is ExposureControlPlaneFieldDecision => entry !== null)
    .sort((left, right) => left.fieldId.localeCompare(right.fieldId));

  return {
    samplePayload:
      typeof record.samplePayload === "object" && record.samplePayload !== null
        ? (record.samplePayload as Readonly<Record<string, unknown>>)
        : {},
    decisions,
    engineSelectedFieldIds: decisions
      .filter((decision) => decision.state === "visible")
      .map((decision) => decision.fieldId),
  };
}

export async function fetchExposureEnginePreview(
  connectionId: string,
  eventType: string,
): Promise<ExposureEnginePreviewModel> {
  const query = new URLSearchParams({ connectionId, eventType });
  const res = await fetch(`/api/exposure/engine-preview?${query.toString()}`, {
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const code =
      typeof payload === "object" &&
      payload !== null &&
      typeof (payload as Record<string, unknown>).code === "string"
        ? String((payload as Record<string, unknown>).code)
        : `EXPOSURE_ENGINE_PREVIEW_HTTP_${res.status}`;
    throw new Error(code);
  }
  return parseExposureEnginePreviewResponse(payload);
}
