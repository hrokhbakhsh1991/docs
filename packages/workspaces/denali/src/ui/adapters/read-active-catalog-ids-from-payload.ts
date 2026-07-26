import {
  readActiveDestinationIds,
  readActiveEquipmentIds,
} from "../../wizard/denali-wizard-catalog-sanitize";
import { parseLocationsResponse } from "./catalog-parse";

/**
 * Reads active equipment ids from a settings equipment list JSON body
 * (`{ items?: { id, isActive? }[] }`). Missing/invalid `items` → empty list.
 */
export function readActiveEquipmentIdsFromPayload(payload: unknown): readonly string[] {
  if (payload === null || typeof payload !== "object") {
    return readActiveEquipmentIds([]);
  }
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return readActiveEquipmentIds([]);
  }
  return readActiveEquipmentIds(
    items.filter(
      (row): row is { id: string; isActive?: boolean } =>
        row !== null && typeof row === "object" && typeof (row as { id?: unknown }).id === "string"
    )
  );
}

/**
 * Reads active destination ids from a settings locations list JSON body
 * (regions + destinations). Uses package `parseLocationsResponse`.
 */
export function readActiveDestinationIdsFromLocationsPayload(
  payload: unknown
): readonly string[] {
  return readActiveDestinationIds(parseLocationsResponse(payload).destinations);
}

/**
 * Optional payloads: omit a key when the corresponding HTTP response was not OK
 * (caller still owns fetch / status gating).
 */
export function resolveActiveCatalogIdsFromResourcePayloads(input: {
  readonly equipmentPayload?: unknown;
  readonly locationsPayload?: unknown;
}): {
  readonly activeEquipmentIds?: readonly string[];
  readonly activeDestinationIds?: readonly string[];
} {
  return {
    ...(input.equipmentPayload !== undefined
      ? { activeEquipmentIds: readActiveEquipmentIdsFromPayload(input.equipmentPayload) }
      : {}),
    ...(input.locationsPayload !== undefined
      ? {
          activeDestinationIds: readActiveDestinationIdsFromLocationsPayload(
            input.locationsPayload
          ),
        }
      : {}),
  };
}
