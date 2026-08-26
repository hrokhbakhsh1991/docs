import { EquipmentCatalogAvatar } from "../components/equipment-catalog-avatar";
import { EquipmentIconPicker } from "../components/equipment-icon-picker";
import { TourThemeCatalogAvatar } from "../components/tour-theme-catalog-avatar";

export type DenaliSettingsEquipmentUiSurface = {
  readonly EquipmentCatalogAvatar: typeof EquipmentCatalogAvatar;
  readonly EquipmentIconPicker: typeof EquipmentIconPicker;
  readonly TourThemeCatalogAvatar: typeof TourThemeCatalogAvatar;
};

export const denaliSettingsEquipmentUiSurface: DenaliSettingsEquipmentUiSurface = Object.freeze({
  EquipmentCatalogAvatar,
  EquipmentIconPicker,
  TourThemeCatalogAvatar,
});
