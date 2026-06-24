import { isKnownEquipmentIconKey } from "@app-tour/workspace-denali/settings/equipment-icon-registry";

import { SettingsResourceInvalidError } from "./settings.service";

export function parseEquipmentIconKeyInput(
  value: unknown
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
  if (!isKnownEquipmentIconKey(trimmed)) {
    throw new SettingsResourceInvalidError();
  }
  return trimmed;
}
