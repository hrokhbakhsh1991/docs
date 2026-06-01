"use client";

import {
  DENALI_CANONICAL_CATEGORY_VALUES,
  DENALI_CANONICAL_DURATION_VALUES,
  DENALI_CANONICAL_TRANSPORT_MODE_VALUES,
  DENALI_EVENT_VARIANT_VALUES,
} from "@repo/types/denali";

/** Runtime-safe option lists (guards against barrel export drift during module init). */
const CANONICAL_CATEGORY_OPTIONS = DENALI_CANONICAL_CATEGORY_VALUES ?? [];
const CANONICAL_DURATION_OPTIONS = DENALI_CANONICAL_DURATION_VALUES ?? [];
const CANONICAL_TRANSPORT_MODE_OPTIONS = DENALI_CANONICAL_TRANSPORT_MODE_VALUES ?? [];
const EVENT_VARIANT_OPTIONS = DENALI_EVENT_VARIANT_VALUES ?? [];
import type { DenaliZodFieldKind } from "@repo/denali-domain";
import { useTranslations } from "next-intl";
import { Checkbox, FormField, Input, Select } from "@tour/ui";
import { Controller, type Control, type FieldPath } from "react-hook-form";

import { DestinationCombobox } from "@/components/tours/wizard/steps/DestinationCombobox";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { resolveDenaliRegistryFieldLabel } from "@/features/tours/wizard/denali/denaliRegistryFieldLabel";
import {
  canonicalSeedRegistrationPath,
  DENALI_TEMPLATE_SEED_COMPOSITE_ZOD_KINDS,
  DENALI_TEMPLATE_SEED_NUMERIC_ZOD_KINDS,
  getDenaliTemplateSeedFieldDefinition,
  type TourWizardTemplateBuilderFormValues,
} from "@/lib/validation/tour-wizard-template-builder-form";

import styles from "./tour-wizard-template.module.css";

type DestinationOption = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
};

export type DenaliTemplateSeedFieldProps = {
  storagePath: string;
  control: Control<TourWizardTemplateBuilderFormValues>;
  destinationOptions: readonly DestinationOption[];
  leaderOptions: readonly DestinationOption[];
  onDestinationSelected?: (_destinationId: string) => void;
  errorMessage?: string;
  /** When true, label is omitted (parent row supplies field identity). */
  compact?: boolean;
};

function coerceNumberValue(raw: string): number | undefined {
  if (raw.trim() === "") {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function renderScalarControl(
  zodKind: DenaliZodFieldKind,
  storagePath: string,
  value: unknown,
  onChange: (_next: unknown) => void,
  onBlur: () => void,
  destinationOptions: readonly DestinationOption[],
  leaderOptions: readonly DestinationOption[],
  onDestinationSelected?: (_destinationId: string) => void,
  tDenali?: ReturnType<typeof useTranslations<"tours.denali">>,
) {
  if (zodKind === "destinationId") {
    return (
      <DestinationCombobox
        label=""
        placeholder={tDenali?.("basic.destinationPlaceholder") ?? ""}
        options={[...destinationOptions]}
        value={typeof value === "string" ? value : ""}
        onChange={(id) => {
          if (typeof id === "string" && id) {
            onDestinationSelected?.(id);
            onChange(id);
            return;
          }
          onChange("");
        }}
      />
    );
  }

  if (storagePath === "leaderUserIds") {
    return (
      <DestinationCombobox
        label=""
        placeholder={tDenali?.("basic.workspaceLeadersPlaceholder") ?? ""}
        options={[...leaderOptions]}
        multiple
        value={Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []}
        onChange={(ids) => {
          onChange(Array.isArray(ids) ? ids : ids ? [ids] : []);
        }}
      />
    );
  }

  if (DENALI_TEMPLATE_SEED_NUMERIC_ZOD_KINDS.has(zodKind)) {
    const formatThousands =
      storagePath === "overview.peakHeight" ||
      storagePath.startsWith("pricing.") ||
      storagePath === "transport.transportCost" ||
      storagePath === "transport.dongAmount";
    return (
      <PersianNumberInput
        numericMode="integer"
        formatThousands={formatThousands}
        value={typeof value === "number" ? value : ""}
        onChange={(raw) => onChange(coerceNumberValue(raw))}
        onBlur={onBlur}
      />
    );
  }

  if (zodKind === "booleanOptional" || zodKind === "adminCapacityApproval") {
    return (
      <Checkbox
        label=""
        checked={value === true}
        onChange={(event) => onChange(event.target.checked ? true : undefined)}
      />
    );
  }

  if (zodKind === "tourType" && storagePath === "category") {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        onBlur={onBlur}
      >
        <option value="">{tDenali?.("selectPlaceholder") ?? ""}</option>
        {CANONICAL_CATEGORY_OPTIONS.map((category) => (
          <option key={category} value={category}>
            {tDenali?.(`basic.categories.${category}`) ?? category}
          </option>
        ))}
      </Select>
    );
  }

  if (zodKind === "tourType" && storagePath === "duration") {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        onBlur={onBlur}
      >
        <option value="">{tDenali?.("selectPlaceholder") ?? ""}</option>
        {CANONICAL_DURATION_OPTIONS.map((duration) => (
          <option key={duration} value={duration}>
            {tDenali?.(`basic.durations.${duration}`) ?? duration}
          </option>
        ))}
      </Select>
    );
  }

  if (zodKind === "tourType" && storagePath === "eventVariant") {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        onBlur={onBlur}
      >
        <option value="">{tDenali?.("selectPlaceholder") ?? ""}</option>
        {EVENT_VARIANT_OPTIONS.map((variant) => (
          <option key={variant} value={variant}>
            {tDenali?.(`basic.eventVariants.${variant}`) ?? variant}
          </option>
        ))}
      </Select>
    );
  }

  if (zodKind === "transportMode") {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        onBlur={onBlur}
      >
        <option value="">{tDenali?.("selectPlaceholder") ?? ""}</option>
        {CANONICAL_TRANSPORT_MODE_OPTIONS.map((mode) => (
          <option key={mode} value={mode}>
            {tDenali?.(`transport.transportMode.${mode}`) ?? mode}
          </option>
        ))}
      </Select>
    );
  }

  if (zodKind === "isoDateTime" || zodKind === "isoDateTimeOptional") {
    return (
      <Input
        type="datetime-local"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        onBlur={onBlur}
      />
    );
  }

  if (zodKind === "stringArrayDefault") {
    const display = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").join(", ")
      : typeof value === "string"
        ? value
        : "";
    return (
      <Input
        type="text"
        value={display}
        onChange={(event) => {
          const trimmed = event.target.value.trim();
          if (!trimmed) {
            onChange(undefined);
            return;
          }
          onChange(
            trimmed
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean),
          );
        }}
        onBlur={onBlur}
        placeholder="uuid-1, uuid-2"
      />
    );
  }

  return (
    <Input
      type="text"
      value={typeof value === "string" ? value : value == null ? "" : String(value)}
      onChange={(event) => onChange(event.target.value || undefined)}
      onBlur={onBlur}
    />
  );
}

export function DenaliTemplateSeedField({
  storagePath,
  control,
  destinationOptions,
  leaderOptions,
  onDestinationSelected,
  errorMessage,
  compact = false,
}: DenaliTemplateSeedFieldProps) {
  const tDenali = useTranslations("tours.denali");
  const tSettings = useTranslations("settings");
  const definition = getDenaliTemplateSeedFieldDefinition(storagePath);
  const zodKind = definition?.zodKind;
  const fieldPath = canonicalSeedRegistrationPath(storagePath);
  const label = definition
    ? resolveDenaliRegistryFieldLabel(definition.rhfPath, tDenali)
    : storagePath;
  const seedLabel = compact ? tSettings("tourWizardTemplateSeedValueColumn") : label;

  if (!zodKind || DENALI_TEMPLATE_SEED_COMPOSITE_ZOD_KINDS.has(zodKind)) {
    return (
      <FormField
        label={seedLabel}
        description={compact ? undefined : tSettings("tourWizardTemplateSeedCompositeHint")}
      >
        <p className={styles.seedCompositeHint} data-testid={`denali-template-seed-composite-${storagePath}`}>
          {compact ? tSettings("tourWizardTemplateSeedCompositeHint") : <code>{storagePath}</code>}
        </p>
      </FormField>
    );
  }

  return (
    <Controller
      name={fieldPath as FieldPath<TourWizardTemplateBuilderFormValues>}
      control={control}
      render={({ field }) => {
        return (
          <FormField label={seedLabel} error={errorMessage}>
            <div data-testid={`denali-template-seed-${storagePath.replace(/\./g, "-")}`}>
              {renderScalarControl(
                zodKind,
                storagePath,
                field.value,
                field.onChange,
                field.onBlur,
                destinationOptions,
                leaderOptions,
                onDestinationSelected,
                tDenali,
              )}
            </div>
          </FormField>
        );
      }}
    />
  );
}
