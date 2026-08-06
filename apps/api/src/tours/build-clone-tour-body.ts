import type { TourRecord } from "../db/tour-record";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { resolveWorkspacePluginForTenantContext } from "../workspace/resolve-workspace-plugin-for-tenant-context";
import type { CreateTourBody } from "./create-tour.schema";

export type BuildCloneTourBodyInput = {
  readonly source: TourRecord;
  readonly tenantId: string;
  readonly activeEquipmentIds?: readonly string[];
  readonly activeDestinationIds?: readonly string[];
};

/**
 * ED-CLONE-01 / ED-PATCH-01 / DEC-P11-010 — createTour + post-merge PATCH require
 * roots↔data bijection. Do not use plugin.wizard.roots (step ids + missing legacy keys).
 */
export function resolveCanonicalRootsFromData(
  data: Readonly<Record<string, unknown>>
): string[] {
  const roots = Object.keys(data);
  if (roots.length === 0) {
    throw new Error("CANONICAL_EMPTY_DATA");
  }
  return roots;
}

export async function buildCloneTourCreateBody(
  input: BuildCloneTourBodyInput
): Promise<CreateTourBody> {
  const workspaceType = await resolveWorkspaceTypeForTenant(input.tenantId);
  const plugin = await resolveWorkspacePluginForTenantContext(input.tenantId, workspaceType);
  if (plugin.tourClone === undefined) {
    throw new Error("TOUR_CLONE_UNSUPPORTED");
  }

  const canonicalData = input.source.canonical.data as Record<string, unknown>;
  const prepareClone =
    plugin.tourClone.prepareServerCloneCreateData ?? plugin.tourClone.hydrateWizardDraft;
  const hydrated = prepareClone({
    canonicalData,
    activeEquipmentIds: input.activeEquipmentIds,
    activeDestinationIds: input.activeDestinationIds,
  });

  const data = hydrated.data as Record<string, unknown>;
  return {
    roots: resolveCanonicalRootsFromData(data),
    data,
  };
}
