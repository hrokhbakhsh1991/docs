import { SettingsResourceInvalidError } from "./settings-resource-errors";

export type EquipmentIconKeyValidator = (value: string) => boolean;

export function parseEquipmentIconKeyInput(
  value: unknown,
  validateEquipmentIconKey?: EquipmentIconKeyValidator
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new SettingsResourceInvalidError();
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (validateEquipmentIconKey?.(trimmed) !== true) {
    throw new SettingsResourceInvalidError();
  }
  return trimmed;
}
