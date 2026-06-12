import type { TourRecord } from "../db/tour-record";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";
import type { CreateTourBody } from "./create-tour.schema";

export type BuildCloneTourBodyInput = {
  readonly source: TourRecord;
  readonly tenantId: string;
  readonly activeEquipmentIds?: readonly string[];
  readonly activeDestinationIds?: readonly string[];
};

export async function buildCloneTourCreateBody(
  input: BuildCloneTourBodyInput
): Promise<CreateTourBody> {
  const workspaceType = await resolveWorkspaceTypeForTenant(input.tenantId);
  const plugin = resolveWorkspacePluginForType(workspaceType);
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

  return {
    roots: [...plugin.wizard.roots],
    data: hydrated.data,
  };
}
