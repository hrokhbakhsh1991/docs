import { Tag } from "lucide-react";

import {
  isKnownEquipmentIconKey,
  type EquipmentIconKey,
} from "../../settings/equipment-icon-registry";
import { themeSwatchToneClass } from "../logic/denali-theme-picker-logic";
import { EquipmentIcon } from "./equipment-icons";

export type TourThemeCatalogAvatarProps = {
  readonly id: string;
  readonly name: string;
  readonly iconKey?: string | null;
  readonly className?: string;
  readonly size?: "card" | "chip";
};

export function TourThemeCatalogAvatar({
  id,
  name,
  iconKey,
  className,
  size = "card",
}: TourThemeCatalogAvatarProps) {
  const resolvedIconKey: EquipmentIconKey | null =
    iconKey != null && isKnownEquipmentIconKey(iconKey) ? iconKey : null;

  return (
    <span
      className={`denali-theme-picker__swatch ${themeSwatchToneClass(id)}${className ? ` ${className}` : ""}`}
      data-tour-theme-catalog-avatar
      data-tour-theme-catalog-avatar-size={size}
      aria-hidden
    >
      {resolvedIconKey !== null ? (
        <EquipmentIcon iconKey={resolvedIconKey} className="denali-tour-theme-icon" />
      ) : (
        <Tag className="denali-tour-theme-icon denali-tour-theme-icon--fallback" aria-hidden />
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
