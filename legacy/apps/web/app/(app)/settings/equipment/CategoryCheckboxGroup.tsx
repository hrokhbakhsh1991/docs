"use client";

import { DENALI_CATEGORY_ENUM } from "@repo/denali-domain";
import { useTranslations } from "next-intl";

import { Checkbox } from "@tour/ui";

export type CategoryCheckboxGroupProps = {
  value: string[];
  onChange: (_next: string[]) => void;
  disabled?: boolean;
};

/**
 * Registry-driven multi-select for equipment {@link compatibleCategories}.
 */
export function CategoryCheckboxGroup({ value, onChange, disabled }: CategoryCheckboxGroupProps) {
  const tDenali = useTranslations("tours.denali");

  const toggle = (category: (typeof DENALI_CATEGORY_ENUM)[number]) => {
    const set = new Set(value);
    if (set.has(category)) {
      set.delete(category);
    } else {
      set.add(category);
    }
    onChange(DENALI_CATEGORY_ENUM.filter((c) => set.has(c)));
  };

  return (
    <div
      role="group"
      aria-label={tDenali("basic.categoryLabel")}
      data-testid="equipment-compatible-categories"
      style={{ display: "grid", gap: "0.5rem" }}
    >
      {DENALI_CATEGORY_ENUM.map((category) => (
        <Checkbox
          key={category}
          label={tDenali(`basic.categories.${category}`)}
          checked={value.includes(category)}
          disabled={disabled}
          onChange={() => toggle(category)}
          data-testid={`equipment-category-${category}`}
        />
      ))}
    </div>
  );
}
