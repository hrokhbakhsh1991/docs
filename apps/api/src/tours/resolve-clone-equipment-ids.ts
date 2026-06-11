import { getSettingsResourcesRepository } from "../settings/create-settings-resources-repository";

/** Loads tenant equipment catalog ids for server clone gear filtering (DEC-P11-010). */
export async function resolveActiveEquipmentIdsForClone(
  tenantId: string
): Promise<readonly string[]> {
  const repo = getSettingsResourcesRepository();
  const items = await repo.listEquipment(tenantId);
  return items
    .map((item) => item.id.trim())
    .filter((id) => id.length > 0);
}
