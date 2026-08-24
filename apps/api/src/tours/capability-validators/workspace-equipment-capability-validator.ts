import { getWorkspaceEquipmentCapabilities } from "@app-tour/workspace-sdk";
import type {
  WorkspaceValidationPipelineContext,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

import { isRecord, readCanonicalPath, readNonEmptyString } from "./canonical-path.ts";

const GEAR_ITEMS_CANONICAL_PATH = "participants.gearItems";

function validateGearItemShape(item: unknown, index: number): WorkspaceViolation | null {
  if (!isRecord(item)) {
    return {
      code: "WORKSPACE_EQUIPMENT_INVALID",
      message: `participants.gearItems[${index}] must be an object`,
    };
  }

  const equipmentId = readNonEmptyString(item.equipmentId);
  if (equipmentId == null) {
    return {
      code: "WORKSPACE_EQUIPMENT_INVALID",
      message: `participants.gearItems[${index}].equipmentId must be a non-empty string`,
    };
  }

  const name = readNonEmptyString(item.name);
  if (name == null) {
    return {
      code: "WORKSPACE_EQUIPMENT_INVALID",
      message: `participants.gearItems[${index}].name must be a non-empty string`,
    };
  }

  if (item.isRequired !== undefined && typeof item.isRequired !== "boolean") {
    return {
      code: "WORKSPACE_EQUIPMENT_INVALID",
      message: `participants.gearItems[${index}].isRequired must be a boolean when set`,
    };
  }

  return null;
}

/** MAT-002 — generic equipment capability structural validation (CW7-01). */
export function validateWorkspaceEquipmentCapability(
  ctx: WorkspaceValidationPipelineContext
): WorkspaceViolation | null {
  const capabilities = getWorkspaceEquipmentCapabilities(ctx.workspaceType);
  if (capabilities == null || capabilities.wizardTourField !== true) {
    return null;
  }

  const data = ctx.document.data as Record<string, unknown>;
  const rawGearItems = readCanonicalPath(data, GEAR_ITEMS_CANONICAL_PATH);
  if (rawGearItems === undefined) {
    return null;
  }

  if (!Array.isArray(rawGearItems)) {
    return {
      code: "WORKSPACE_EQUIPMENT_INVALID",
      message: "participants.gearItems must be an array when present",
    };
  }

  for (let index = 0; index < rawGearItems.length; index += 1) {
    const violation = validateGearItemShape(rawGearItems[index], index);
    if (violation != null) {
      return violation;
    }
  }

  return null;
}
