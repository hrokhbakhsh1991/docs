import {
  isKnownEquipmentIconKey,
  type EquipmentIconKey,
} from "../../settings/equipment-icon-registry";
import { themeDisplayInitials, themeSwatchToneClass } from "../logic/denali-theme-picker-logic";
import { EquipmentIcon } from "./equipment-icons";

export type EquipmentCatalogAvatarProps = {
  readonly id: string;
  readonly name: string;
  readonly iconKey?: string | null;
  readonly className?: string;
};

export function EquipmentCatalogAvatar({
  id,
  name,
  iconKey,
  className,
}: EquipmentCatalogAvatarProps) {
  const resolvedIconKey: EquipmentIconKey | null =
    iconKey != null && isKnownEquipmentIconKey(iconKey) ? iconKey : null;

  return (
    <span
      className={`denali-gear-picker__swatch ${themeSwatchToneClass(id)}${className ? ` ${className}` : ""}`}
      data-equipment-catalog-avatar
    >
      {resolvedIconKey !== null ? (
        <EquipmentIcon iconKey={resolvedIconKey} className="denali-equipment-icon" />
      ) : (
        themeDisplayInitials(name)
      )}
    </span>
  );
}
