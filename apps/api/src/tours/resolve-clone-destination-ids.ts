import { getSettingsResourcesRepository } from "../settings/create-settings-resources-repository";

/** Loads active tenant destination ids for server clone itinerary filtering. */
export async function resolveActiveDestinationIdsForClone(
  tenantId: string
): Promise<readonly string[]> {
  const repo = getSettingsResourcesRepository();
  const items = await repo.listDestinations(tenantId);
  return items
    .filter((item) => item.isActive !== false)
    .map((item) => item.id.trim())
    .filter((id) => id.length > 0);
}
