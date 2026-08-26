import type { ComponentType } from "react";

export type SettingsEquipmentCatalogAvatarProps = {
  readonly id: string;
  readonly name: string;
  readonly iconKey?: string | null;
  readonly className?: string;
};

export type SettingsEquipmentIconPickerProps = {
  readonly name: string;
  readonly value: string | null;
  readonly onChange: (iconKey: string | null) => void;
  readonly previewSubtitle?: string;
};

export type SettingsTourThemeCatalogAvatarProps = {
  readonly id: string;
  readonly name: string;
  readonly iconKey?: string | null;
  readonly className?: string;
  readonly size?: "card" | "chip";
};

export type SettingsEquipmentUiSurface = {
  readonly EquipmentCatalogAvatar: ComponentType<SettingsEquipmentCatalogAvatarProps>;
  readonly EquipmentIconPicker: ComponentType<SettingsEquipmentIconPickerProps>;
  readonly TourThemeCatalogAvatar: ComponentType<SettingsTourThemeCatalogAvatarProps>;
};
