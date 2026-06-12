import { resolveEquipmentCompatibleCategories } from "@app-tour/workspace-denali/settings/equipment-compatible-categories";

import type { EquipmentResource } from "./settings.types";

export function enrichEquipmentCompatibleCategories(
  equipment: EquipmentResource
): EquipmentResource {
  return Object.freeze({
    ...equipment,
    compatibleCategories: resolveEquipmentCompatibleCategories(equipment.category),
  });
}

export function enrichEquipmentListCompatibleCategories(
  items: readonly EquipmentResource[]
): EquipmentResource[] {
  return items.map((item) => enrichEquipmentCompatibleCategories(item));
}
