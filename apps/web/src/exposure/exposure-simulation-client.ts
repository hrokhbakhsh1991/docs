import type { ExposureControlPlaneFieldDecision } from "./exposure-control-plane-client";
import {
  parseExposureEnginePreviewResponse,
  type ExposureEnginePreviewModel,
} from "./exposure-engine-preview-client";

export type ExposureSimulationDraftIntent = {
  readonly mode: "inherit_profile" | "override_fields" | "disabled";
  readonly selectedFieldIds: readonly string[];
  readonly templateOverrideId?: string;
};

export type ExposureSimulationRequest = {
  readonly connectionId: string;
  readonly eventType: string;
  readonly draftIntent?: ExposureSimulationDraftIntent;
};

export type ExposureSimulationModel = {
  readonly samplePayload: ExposureEnginePreviewModel["samplePayload"];
  readonly decisions: ExposureEnginePreviewModel["decisions"];
  readonly engineSelectedFieldIds: ExposureEnginePreviewModel["engineSelectedFieldIds"];
  readonly simulation: {
    readonly connectionId: string;
    readonly eventType: string;
    readonly effectiveContext: {
      readonly surface: string;
      readonly audience: string;
      readonly trigger: string;
    };
    readonly draftIntentApplied: boolean;
  };
};

export type ExposureSimulationDiffModel = {
  readonly current: ExposureSimulationModel;
  readonly simulated: ExposureSimulationModel;
  readonly diff: {
    readonly changedFieldIds: readonly string[];
    readonly fieldChanges: readonly {
      readonly fieldId: string;
      readonly currentState: ExposureControlPlaneFieldDecision["state"] | "missing";
      readonly simulatedState: ExposureControlPlaneFieldDecision["state"] | "missing";
    }[];
    readonly selectedFieldIdsAdded: readonly string[];
    readonly selectedFieldIdsRemoved: readonly string[];
  };
};

const EXPOSURE_DIFF_STATES = new Set([
  "visible",
  "hidden",
  "redacted",
  "summary_only",
  "blocked",
  "missing",
]);

function parseStringArray(payload: unknown): readonly string[] {
  return Array.isArray(payload)
    ? payload.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function parseSimulationMeta(payload: unknown): ExposureSimulationModel["simulation"] {
  const record =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const effectiveContextRaw =
    typeof record.effectiveContext === "object" && record.effectiveContext !== null
      ? (record.effectiveContext as Record<string, unknown>)
      : {};
  return {
    connectionId: typeof record.connectionId === "string" ? record.connectionId : "",
    eventType: typeof record.eventType === "string" ? record.eventType : "",
    effectiveContext: {
      surface:
        typeof effectiveContextRaw.surface === "string" ? effectiveContextRaw.surface : "",
      audience:
        typeof effectiveContextRaw.audience === "string" ? effectiveContextRaw.audience : "",
      trigger:
        typeof effectiveContextRaw.trigger === "string" ? effectiveContextRaw.trigger : "",
    },
    draftIntentApplied: record.draftIntentApplied === true,
  };
}

export function parseExposureSimulationResponse(payload: unknown): ExposureSimulationModel {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("EXPOSURE_SIMULATION_INVALID");
  }
  const record = payload as Record<string, unknown>;
  const preview = parseExposureEnginePreviewResponse(record);
  return {
    ...preview,
    simulation: parseSimulationMeta(record.simulation),
  };
}

function parseFieldChanges(payload: unknown): ExposureSimulationDiffModel["diff"]["fieldChanges"] {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const fieldId = typeof record.fieldId === "string" ? record.fieldId : "";
      const currentState = record.currentState;
      const simulatedState = record.simulatedState;
      if (
        fieldId.length === 0 ||
        typeof currentState !== "string" ||
        typeof simulatedState !== "string" ||
        !EXPOSURE_DIFF_STATES.has(currentState) ||
        !EXPOSURE_DIFF_STATES.has(simulatedState)
      ) {
        return null;
      }
      return {
        fieldId,
        currentState: currentState as ExposureControlPlaneFieldDecision["state"] | "missing",
        simulatedState: simulatedState as ExposureControlPlaneFieldDecision["state"] | "missing",
      };
    })
    .filter((entry): entry is ExposureSimulationDiffModel["diff"]["fieldChanges"][number] =>
      entry !== null,
    );
}

export function parseExposureSimulationDiffResponse(
  payload: unknown,
): ExposureSimulationDiffModel {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("EXPOSURE_SIMULATION_DIFF_INVALID");
  }
  const record = payload as Record<string, unknown>;
  const diffRaw =
    typeof record.diff === "object" && record.diff !== null
      ? (record.diff as Record<string, unknown>)
      : {};

  return {
    current: parseExposureSimulationResponse(record.current),
    simulated: parseExposureSimulationResponse(record.simulated),
    diff: {
      changedFieldIds: parseStringArray(diffRaw.changedFieldIds),
      fieldChanges: parseFieldChanges(diffRaw.fieldChanges),
      selectedFieldIdsAdded: parseStringArray(diffRaw.selectedFieldIdsAdded),
      selectedFieldIdsRemoved: parseStringArray(diffRaw.selectedFieldIdsRemoved),
    },
  };
}

async function postSimulationRequest(path: string, body: ExposureSimulationRequest): Promise<unknown> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const code =
      typeof payload === "object" &&
      payload !== null &&
      typeof (payload as Record<string, unknown>).code === "string"
        ? String((payload as Record<string, unknown>).code)
        : `EXPOSURE_SIMULATION_HTTP_${res.status}`;
    throw new Error(code);
  }
  return payload;
}

export async function fetchExposureSimulation(
  body: ExposureSimulationRequest,
): Promise<ExposureSimulationModel> {
  return parseExposureSimulationResponse(
    await postSimulationRequest("/api/exposure/simulate", body),
  );
}

export async function fetchExposureSimulationDiff(
  body: ExposureSimulationRequest,
): Promise<ExposureSimulationDiffModel> {
  return parseExposureSimulationDiffResponse(
    await postSimulationRequest("/api/exposure/diff", body),
  );
}
