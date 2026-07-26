import {
  adaptWorkspaceFieldPolicyManifest,
  type FieldDefinition,
  type FieldPolicyEntityState,
} from "@app-tour/platform-core";
import type { WorkspaceLifecycleContract } from "@app-tour/workspace-sdk";

import { exposureCatalogFieldIds } from "../../exposure/exposure-field-catalog";
import { resolveWorkspacePluginForType } from "../../workspace/resolve-workspace-plugin";

export type ResolveDeliveryFieldPolicyInput = {
  readonly tenantId: string;
  readonly workspaceType: string | null;
  readonly eventType?: string;
  readonly exposureSurface?: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  /** Admin-selected field ids, or omit/null to use ExposureProfile-seeded defaults. */
  readonly requestedFieldIds?: readonly string[] | null;
};

export type ResolvedDeliveryFieldPolicy = {
  readonly candidateFieldIds: readonly string[];
  readonly eligibleFieldIds: readonly string[];
  /** Definitions for the downstream canonical enrichment stage only. */
  readonly definitions: readonly FieldDefinition[];
};

export type BuildDeliveryFieldPolicyEntityStateInput = {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly eventType?: string;
  readonly lifecycle?: Pick<WorkspaceLifecycleContract, "initialStatus">;
};

function readNestedRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function readTourStatus(payload: Readonly<Record<string, unknown>>): string | undefined {
  if (typeof payload.status === "string" && payload.status.trim().length > 0) {
    return payload.status.trim();
  }
  const tour = readNestedRecord(payload.tour);
  return typeof tour?.status === "string" && tour.status.trim().length > 0
    ? tour.status.trim()
    : undefined;
}

/**
 * Maps outbox/domain payload facts into the platform entity-state contract.
 * TourCreated payloads are typically `{ tenantId, tourId }` only — lifecycle initialStatus fills the gap.
 */
export function buildDeliveryFieldPolicyEntityState(
  input: BuildDeliveryFieldPolicyEntityStateInput,
): FieldPolicyEntityState {
  const status =
    readTourStatus(input.payload) ??
    (input.eventType === "TourCreated" ? input.lifecycle?.initialStatus : undefined);

  return status === undefined
    ? {}
    : {
        tour: { status },
      };
}

async function resolveWorkspacePluginSafely(workspaceType: string) {
  try {
    return await resolveWorkspacePluginForType(workspaceType);
  } catch {
    return null;
  }
}

/**
 * Phase E — definitions-only adapter for cutover enrichment.
 * Uses the full exposure catalog; does not compute legacy eligible/candidate ids.
 */
export async function resolveDeliveryFieldDefinitions(
  input: Omit<ResolveDeliveryFieldPolicyInput, "requestedFieldIds">,
): Promise<readonly FieldDefinition[] | null> {
  if (input.workspaceType === null || input.workspaceType.trim().length === 0) {
    return null;
  }

  const plugin = await resolveWorkspacePluginSafely(input.workspaceType);
  if (plugin === null || plugin.fieldPolicy === undefined) {
    return null;
  }

  const candidateFieldIds = await exposureCatalogFieldIds(input.workspaceType);
  if (candidateFieldIds.length === 0) {
    return [];
  }

  const adapted = adaptWorkspaceFieldPolicyManifest({
    workspaceType: input.workspaceType,
    manifest: plugin.fieldPolicy,
    fieldRegistry: plugin.fieldRegistry,
    candidateFieldIds,
  });

  return adapted.definitions;
}
