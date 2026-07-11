"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { SelectOption } from "../adapters/platform-primitives";
import { Select } from "../adapters/platform-primitives";
import { shouldUseDenaliWizardCustomSelectPanel } from "../logic/denali-anchored-popover-logic";
import { DenaliSearchableSelect } from "./denali-searchable-select";

export type DenaliWizardSelectProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly invalid?: boolean;
  readonly "aria-label"?: string;
  readonly className?: string;
  readonly "data-testid"?: string;
  readonly searchableThreshold?: number;
  readonly searchLabel?: string;
  readonly searchPlaceholder?: string;
  readonly searchEmptyMessage?: string;
};

/** Wizard select — portaled custom panel on mobile; native select on wide viewports when small lists. */
export function DenaliWizardSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  loading = false,
  disabled = false,
  required = false,
  invalid = false,
  "aria-label": ariaLabel,
  className,
  "data-testid": dataTestId,
  searchableThreshold,
  searchLabel,
  searchPlaceholder,
  searchEmptyMessage,
}: DenaliWizardSelectProps) {
  const t = useTranslations("denali");
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    const readWidth = () => setViewportWidth(window.innerWidth);
    readWidth();
    window.addEventListener("resize", readWidth);
    return () => window.removeEventListener("resize", readWidth);
  }, []);

  const useCustomPanel =
    viewportWidth != null &&
    shouldUseDenaliWizardCustomSelectPanel(options.length, searchableThreshold, viewportWidth);

  if (useCustomPanel) {
    return (
      <DenaliSearchableSelect
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        loading={loading}
        disabled={disabled}
        required={required}
        invalid={invalid}
        ariaLabel={ariaLabel ?? ""}
        className={className}
        testId={dataTestId}
        searchableThreshold={searchableThreshold ?? 0}
        searchLabel={searchLabel ?? t("composites.common.select.searchLabel")}
        searchPlaceholder={searchPlaceholder ?? t("composites.common.select.searchPlaceholder")}
        searchEmptyMessage={searchEmptyMessage ?? t("composites.common.select.searchEmptyMessage")}
      />
    );
  }

  return (
    <Select
      id={id}
      data-testid={dataTestId}
      className={className}
      aria-label={ariaLabel}
      options={options}
      value={value}
      placeholder={placeholder}
      required={required}
      invalid={invalid}
      disabled={disabled || loading}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
