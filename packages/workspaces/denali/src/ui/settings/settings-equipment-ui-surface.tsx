import { EquipmentCatalogAvatar } from "../components/equipment-catalog-avatar";
import { EquipmentIconPicker } from "../components/equipment-icon-picker";

export type DenaliSettingsEquipmentUiSurface = {
  readonly EquipmentCatalogAvatar: typeof EquipmentCatalogAvatar;
  readonly EquipmentIconPicker: typeof EquipmentIconPicker;
};

export const denaliSettingsEquipmentUiSurface: DenaliSettingsEquipmentUiSurface = Object.freeze({
  EquipmentCatalogAvatar,
  EquipmentIconPicker,
});
