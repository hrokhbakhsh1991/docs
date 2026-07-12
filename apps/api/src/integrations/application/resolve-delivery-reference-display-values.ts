import { getCanonicalValue, type FieldDefinition } from "@app-tour/platform-core";

import { getSettingsResourcesRepository } from "../../settings/create-settings-resources-repository";
import {
  listDeliveryReferenceDisplayFieldIds,
  supportsDeliveryReferenceDisplay,
} from "../../integrations/platform/workspace-integration-capabilities.generated.ts";

function readTenantId(payload: Readonly<Record<string, unknown>>): string | null {
  const raw = payload.tenantId;
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readCanonicalPathByFieldId(
  definitions: readonly FieldDefinition[],
): ReadonlyMap<string, string> {
  return new Map(definitions.map((definition) => [definition.id, definition.canonicalPath] as const));
}

function readReferenceId(
  payload: Readonly<Record<string, unknown>>,
  canonicalPath: string,
): string | null {
  const raw = getCanonicalValue(payload, canonicalPath);
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves tenant catalog display strings for reference-id canonical paths at dispatch time.
 * Pure enrichment stays HTTP-free; dispatch injects the returned map before enrich runs.
 */
export async function resolveDeliveryReferenceDisplayValues(input: {
  readonly tenantId: string;
  readonly workspaceType: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly eligibleFieldIds: readonly string[];
  readonly definitions: readonly FieldDefinition[];
}): Promise<Readonly<Record<string, string>>> {
  if (!supportsDeliveryReferenceDisplay(input.workspaceType)) {
    return {};
  }

  const eligibleFieldIds = listDeliveryReferenceDisplayFieldIds(input.workspaceType);
  const tenantId = readTenantId(input.payload) ?? input.tenantId;
  const canonicalPathById = readCanonicalPathByFieldId(input.definitions);
  const values: Record<string, string> = {};

  const destinationFieldId = eligibleFieldIds.find((fieldId) => fieldId.endsWith(".destination"));
  if (
    destinationFieldId !== undefined &&
    input.eligibleFieldIds.includes(destinationFieldId)
  ) {
    const destinationPath = canonicalPathById.get(destinationFieldId) ?? "destinationId";
    const destinationId = readReferenceId(input.payload, destinationPath);
    if (destinationId !== null) {
      const destinations = await getSettingsResourcesRepository().listDestinations(tenantId);
      const destination = destinations.find((item) => item.id === destinationId);
      if (destination !== undefined) {
        const name = destination.name.trim();
        if (name.length > 0) {
          values[destinationPath] = name;
        }
      }
    }
  }

  return values;
}
