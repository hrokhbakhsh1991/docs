export type DenaliGearItem = {
  readonly equipmentId: string;
  readonly name: string;
  readonly isRequired?: boolean;
};

export function parseDenaliGearItems(value: unknown): DenaliGearItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object")
    .map((entry) => ({
      equipmentId: String(entry.equipmentId ?? entry.id ?? ""),
      name: String(entry.name ?? ""),
      ...(entry.isRequired === true ? { isRequired: true } : {}),
    }))
    .filter((item) => item.equipmentId.length > 0);
}
