import type { DenaliGearItem } from "@/features/tours/wizard/schemas/denaliGearItemSchema";

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
  for (const row of items ?? []) {
    if (row.isRequired === true) {
      required.push(row);
    } else {
      optional.push(row);
    }
  }
  return { required, optional };
}
