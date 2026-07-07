"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  EQUIPMENT_ICON_CATEGORIES,
  EQUIPMENT_ICON_REGISTRY,
  listEquipmentIconsByCategory,
  suggestEquipmentIconKey,
  type EquipmentIconCategory,
  type EquipmentIconKey,
} from "../../settings/equipment-icon-registry";
import { Input } from "../adapters/platform-primitives";
import { EquipmentCatalogAvatar } from "./equipment-catalog-avatar";
import { EquipmentIcon } from "./equipment-icons";

export type EquipmentIconPickerProps = {
  readonly name: string;
  readonly value: string | null;
  readonly onChange: (iconKey: string | null) => void;
  readonly previewSubtitle?: string;
};

const CATEGORY_LABEL_KEYS: Record<EquipmentIconCategory, string> = {
  hiking: "composites.gear.iconCategories.hiking",
  camp: "composites.gear.iconCategories.camp",
  clothing: "composites.gear.iconCategories.clothing",
  safety: "composites.gear.iconCategories.safety",
  food_water: "composites.gear.iconCategories.foodWater",
  general: "composites.gear.iconCategories.general",
};

export function EquipmentIconPicker({
  name,
  value,
  onChange,
  previewSubtitle,
}: EquipmentIconPickerProps) {
  const t = useTranslations("denali");
  const [activeCategory, setActiveCategory] = useState<EquipmentIconCategory>("hiking");
  const [searchQuery, setSearchQuery] = useState("");

  const suggestion = useMemo(() => suggestEquipmentIconKey(name), [name]);

  const filteredIcons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const pool =
      query.length > 0
        ? EQUIPMENT_ICON_REGISTRY
        : listEquipmentIconsByCategory(activeCategory);
    if (query.length === 0) {
      return pool;
    }
    return EQUIPMENT_ICON_REGISTRY.filter((entry) => {
      const label = t(entry.labelKey).toLowerCase();
      return (
        entry.key.includes(query) ||
        label.includes(query) ||
        entry.keywords.some((keyword) => keyword.toLowerCase().includes(query))
      );
    });
  }, [activeCategory, searchQuery, t]);

  const previewId = "equipment-icon-preview";

  return (
    <div className="denali-equipment-icon-picker" data-equipment-icon-picker>
      <div className="denali-equipment-icon-picker__header">
        <p className="denali-equipment-icon-picker__label">{t("composites.gear.iconPickerLabel")}</p>
        <p className="denali-equipment-icon-picker__helper">{t("composites.gear.iconPickerHelper")}</p>
      </div>

      <div className="denali-equipment-icon-picker__preview" aria-live="polite">
        <EquipmentCatalogAvatar id={previewId} name={name} iconKey={value} />
        <div className="denali-equipment-icon-picker__preview-text">
          <span className="denali-equipment-icon-picker__preview-name">
            {name.trim().length > 0 ? name : t("composites.gear.iconPreviewPlaceholder")}
          </span>
          {previewSubtitle ? (
            <span className="denali-equipment-icon-picker__preview-subtitle">{previewSubtitle}</span>
          ) : null}
        </div>
      </div>

      {suggestion !== null && suggestion !== value ? (
        <div className="denali-equipment-icon-picker__suggestion">
          <span>{t("composites.gear.iconSuggestion", { label: t(`composites.gear.icons.${suggestion}`) })}</span>
          <button
            type="button"
            className="denali-equipment-icon-picker__suggestion-btn"
            onClick={() => onChange(suggestion)}
          >
            {t("composites.gear.iconSuggestionApply")}
          </button>
        </div>
      ) : null}

      <label className="denali-wizard-picker__search">
        <span className="denali-wizard-picker__search-label">{t("composites.gear.iconSearchLabel")}</span>
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t("composites.gear.iconSearchPlaceholder")}
          aria-label={t("composites.gear.iconSearchLabel")}
        />
      </label>

      {searchQuery.trim().length === 0 ? (
        <div className="denali-equipment-icon-picker__categories" role="tablist" aria-label={t("composites.gear.iconCategoriesLabel")}>
          {EQUIPMENT_ICON_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={activeCategory === category}
              className={
                activeCategory === category
                  ? "denali-equipment-icon-picker__category denali-equipment-icon-picker__category--active"
                  : "denali-equipment-icon-picker__category"
              }
              onClick={() => setActiveCategory(category)}
            >
              {t(CATEGORY_LABEL_KEYS[category])}
            </button>
          ))}
        </div>
      ) : null}

      <div className="denali-equipment-icon-picker__grid" role="list">
        {filteredIcons.map((entry) => {
          const selected = value === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              role="listitem"
              className={
                selected
                  ? "denali-equipment-icon-picker__option denali-equipment-icon-picker__option--selected"
                  : "denali-equipment-icon-picker__option"
              }
              aria-pressed={selected}
              aria-label={t(entry.labelKey)}
              onClick={() => onChange(entry.key)}
            >
              <span className={`denali-equipment-icon-picker__option-swatch ${selected ? "denali-equipment-icon-picker__option-swatch--selected" : ""}`}>
                <EquipmentIcon iconKey={entry.key} className="denali-equipment-icon" />
              </span>
              <span className="denali-equipment-icon-picker__option-label">{t(entry.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="denali-equipment-icon-picker__clear"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        {t("composites.gear.iconUseInitials")}
      </button>
    </div>
  );
}

export type { EquipmentIconKey };
