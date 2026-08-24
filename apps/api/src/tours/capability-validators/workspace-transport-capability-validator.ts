import {
  getWorkspaceTransportCapabilities,
  type PublicCatalogTransportMode,
} from "@app-tour/workspace-sdk";
import type {
  WorkspaceValidationPipelineContext,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

import { isRecord, readCanonicalPath, readFiniteNumber, readNonEmptyString } from "./canonical-path.ts";

const TRANSPORT_MODE_CANONICAL_PATH = "transport.mode";
const TRANSPORT_MODE_ALIAS_PATH = "transport.transportMode";

const KNOWN_TRANSPORT_MODES: readonly PublicCatalogTransportMode[] = [
  "organizer_vehicle",
  "bus",
  "minibus",
  "train",
  "shared_cars",
  "none",
];

function readTransportMode(data: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(readCanonicalPath(data, TRANSPORT_MODE_CANONICAL_PATH)) ??
    readNonEmptyString(readCanonicalPath(data, TRANSPORT_MODE_ALIAS_PATH))
  );
}

function validateOptionalIntegerField(
  data: Record<string, unknown>,
  path: string,
  label: string
): WorkspaceViolation | null {
  const value = readCanonicalPath(data, path);
  if (value === undefined) {
    return null;
  }
  const parsed = readFiniteNumber(value);
  if (parsed == null || !Number.isInteger(parsed)) {
    return {
      code: "WORKSPACE_TRANSPORT_INVALID",
      message: `${label} must be a finite integer when present`,
    };
  }
  return null;
}

/** MAT-002 — generic transport capability structural validation (CW7-05). */
export function validateWorkspaceTransportCapability(
  ctx: WorkspaceValidationPipelineContext
): WorkspaceViolation | null {
  const capabilities = getWorkspaceTransportCapabilities(ctx.workspaceType);
  if (capabilities == null || capabilities.wizardTourField !== true) {
    return null;
  }

  const data = ctx.document.data as Record<string, unknown>;
  const transport = readCanonicalPath(data, "transport");
  if (transport === undefined) {
    return null;
  }

  if (!isRecord(transport)) {
    return {
      code: "WORKSPACE_TRANSPORT_INVALID",
      message: "transport must be an object when present",
    };
  }

  const mode = readTransportMode(data);
  if (mode != null && !(KNOWN_TRANSPORT_MODES as readonly string[]).includes(mode)) {
    return {
      code: "WORKSPACE_TRANSPORT_INVALID",
      message: `transport.mode must be one of: ${KNOWN_TRANSPORT_MODES.join(", ")}`,
    };
  }

  const allowPersonalCar = readCanonicalPath(data, "transport.allowPersonalCar");
  if (allowPersonalCar !== undefined && typeof allowPersonalCar !== "boolean") {
    return {
      code: "WORKSPACE_TRANSPORT_INVALID",
      message: "transport.allowPersonalCar must be a boolean when present",
    };
  }

  for (const [path, label] of [
    ["transport.transportCost", "transport.transportCost"],
    ["transport.dongAmount", "transport.dongAmount"],
  ] as const) {
    const violation = validateOptionalIntegerField(data, path, label);
    if (violation != null) {
      return violation;
    }
  }

  return null;
}
