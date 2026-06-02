import type { SettingsEquipmentDto } from "@/hooks/use-settings-equipment";
import type { DenaliGearItem } from "@/features/tours/wizard/schemas/denaliGearItemSchema";

function equipmentMatchesCatalogCategory(
  row: SettingsEquipmentDto,
  categorySlug: string | undefined,
): boolean {
  const compatibleCategories = row.compatibleCategories ?? [];
  if (compatibleCategories.length === 0) {
    return true;
  }
  if (categorySlug == null || categorySlug === "") {
    return false;
  }
  return compatibleCategories.includes(categorySlug);
}

export function upsertGearItem(
  items: DenaliGearItem[] | undefined,
  id: string,
  patch: Partial<DenaliGearItem>,
): DenaliGearItem[] {
  const list = [...(items ?? [])];
  const idx = list.findIndex((row) => row.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx]!, ...patch, id };
    return list;
  }
  return [...list, { id, isRequired: patch.isRequired ?? false }];
}

export function removeGearItem(items: DenaliGearItem[] | undefined, id: string): DenaliGearItem[] {
  return (items ?? []).filter((row) => row.id !== id);
}

export function normalizeGearItems(items: DenaliGearItem[] | undefined): DenaliGearItem[] | undefined {
  return items != null && items.length > 0 ? items : undefined;
}

/** Maps settings/preset `gearRequiredIds` + `gearOptionalIds` into wizard `gearItems`. */
export function gearCatalogIdsToGearItems(
  gearRequiredIds: string[] | undefined,
  gearOptionalIds: string[] | undefined,
): DenaliGearItem[] | undefined {
  const required = new Set((gearRequiredIds ?? []).map((id) => id.trim()).filter(Boolean));
  const optional = new Set((gearOptionalIds ?? []).map((id) => id.trim()).filter(Boolean));
  if (required.size === 0 && optional.size === 0) {
    return undefined;
  }
  const items: DenaliGearItem[] = [];
  for (const id of required) {
    items.push({ id, isRequired: true });
  }
  for (const id of optional) {
    if (!required.has(id)) {
      items.push({ id, isRequired: false });
    }
  }
  return normalizeGearItems(items);
}

export function splitGearByRequired(items: DenaliGearItem[] | undefined): {
  required: DenaliGearItem[];
  optional: DenaliGearItem[];
} {
  const required: DenaliGearItem[] = [];
  const optional: DenaliGearItem[] = [];
  const seen = new Set<string>();
  for (const row of items ?? []) {
    const id = row.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (row.isRequired === true) {
      required.push(row);
    } else {
      optional.push(row);
    }
  }
  return { required, optional };
}

function syntheticEquipmentRow(id: string): SettingsEquipmentDto {
  return {
    id,
    name: id,
    slug: id,
    compatibleCategories: [],
    description: null,
    icon: null,
    isActive: false,
    sortOrder: 9999,
    createdAt: "",
    updatedAt: "",
  };
}

export type GearDisplayListModel = {
  displayEquipment: SettingsEquipmentDto[];
  activeCatalogIds: ReadonlySet<string>;
  selectedById: ReadonlyMap<string, DenaliGearItem>;
  categoryFilteredCount: number;
};

/** Category-filtered active catalog plus preserved RHF selections outside the filter. */
export function buildGearDisplayList(
  catalog: readonly SettingsEquipmentDto[] | undefined,
  categorySlug: string | undefined,
  gearItems: readonly DenaliGearItem[] | undefined,
): GearDisplayListModel {
  const rows = catalog ?? [];
  const byId = new Map<string, SettingsEquipmentDto>();
  const activeCatalogIds = new Set<string>();
  const visible: SettingsEquipmentDto[] = [];

  for (const row of rows) {
    const id = row.id.trim();
    if (!id) {
      continue;
    }
    byId.set(id, row);
    if (!row.isActive) {
      continue;
    }
    activeCatalogIds.add(id);
    if (equipmentMatchesCatalogCategory(row, categorySlug)) {
      visible.push(row);
    }
  }

  const selectedById = new Map<string, DenaliGearItem>();
  for (const item of gearItems ?? []) {
    const id = item.id.trim();
    if (!id) {
      continue;
    }
    selectedById.set(id, { id, isRequired: item.isRequired === true });
  }

  const visibleIds = new Set(visible.map((row) => row.id.trim()));
  const extras: SettingsEquipmentDto[] = [];
  for (const id of selectedById.keys()) {
    if (visibleIds.has(id)) {
      continue;
    }
    extras.push(byId.get(id) ?? syntheticEquipmentRow(id));
  }

  return {
    displayEquipment: [...visible, ...extras],
    activeCatalogIds,
    selectedById,
    categoryFilteredCount: visible.length,
  };
}
