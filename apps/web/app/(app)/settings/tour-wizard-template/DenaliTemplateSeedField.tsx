"use client";

import {
  DENALI_CANONICAL_CATEGORY_VALUES,
  DENALI_CANONICAL_DURATION_VALUES,
  DENALI_CANONICAL_TRANSPORT_MODE_VALUES,
  denaliCanonicalBasicsFromTourKind,
  denaliTourKindFromCanonical,
  type DenaliCanonicalCategory,
  type DenaliCanonicalDuration,
  type DenaliTourDuration,
  type DenaliTourKind,
} from "@repo/types/denali";

/** Runtime-safe option lists (guards against barrel export drift during module init). */
const CANONICAL_CATEGORY_OPTIONS = DENALI_CANONICAL_CATEGORY_VALUES ?? [];
const CANONICAL_DURATION_OPTIONS = DENALI_CANONICAL_DURATION_VALUES ?? [];
const CANONICAL_TRANSPORT_MODE_OPTIONS = DENALI_CANONICAL_TRANSPORT_MODE_VALUES ?? [];
import type { DenaliZodFieldKind } from "@repo/denali-domain";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { Checkbox, FormField, Input, Select } from "@tour/ui";
import {
  Controller,
  useWatch,
  type Control,
  type FieldPath,
  type UseFormSetValue,
} from "react-hook-form";

import { DestinationCombobox } from "@/components/tours/wizard/steps/DestinationCombobox";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { resolveDenaliRegistryFieldLabel } from "@/features/tours/wizard/denali/denaliRegistryFieldLabel";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  DENALI_TEMPLATE_SEED_COMPOSITE_ZOD_KINDS,
  DENALI_TEMPLATE_SEED_NUMERIC_ZOD_KINDS,
  DENALI_TEMPLATE_SEED_THOUSANDS_FORMAT_PATHS,
  getDenaliTemplateSeedFieldDefinition,
  templateSeedRhfPath,
} from "@/lib/validation/tour-wizard-template-builder-form";

import styles from "./tour-wizard-template.module.css";

type DestinationOption = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
};

const CLASSIFICATION_SEED_PATHS = new Set<string>(["category", "duration"]);

function canonicalDurationFromBasics(
  duration: DenaliTourDuration | undefined,
): DenaliCanonicalDuration | "" {
  if (duration === "multi_day") {
    return "multi";
  }
  if (duration === "single_day") {
    return "single";
  }
  return "";
}

function basicsDurationFromCanonical(duration: string): DenaliTourDuration | undefined {
  if (duration === "multi") {
    return "multi_day";
  }
  if (duration === "single") {
    return "single_day";
  }
  return undefined;
}

export type DenaliTemplateSeedFieldProps = {
  storagePath: string;
  control: Control<DenaliCreateTourWizardForm>;
  setWizardValue: UseFormSetValue<DenaliCreateTourWizardForm>;
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

type TemplateClassificationSeedProps = {
  storagePath: "category" | "duration";
  control: Control<DenaliCreateTourWizardForm>;
  setWizardValue: UseFormSetValue<DenaliCreateTourWizardForm>;
  tDenali: ReturnType<typeof useTranslations<"tours.denali">>;
};

function TemplateClassificationSeed({
  storagePath,
  control,
  setWizardValue,
  tDenali,
}: TemplateClassificationSeedProps) {
  const tourType = useWatch({ control, name: "basicInfo.tourType" }) as DenaliTourKind | string | undefined;
  const slug = typeof tourType === "string" && tourType.trim() !== "" ? tourType.trim() : undefined;
  const basics = denaliCanonicalBasicsFromTourKind(slug as DenaliTourKind | undefined);

  const applyClassification = useCallback(
    (patch: { category?: DenaliCanonicalCategory; duration?: DenaliCanonicalDuration }) => {
      const category = patch.category ?? basics?.category;
      const durationBasics =
        patch.duration != null
          ? basicsDurationFromCanonical(patch.duration)
          : basics?.duration;
      if (!category || !durationBasics) {
        setWizardValue("basicInfo.tourType", "", { shouldDirty: true });
        return;
      }
      const nextSlug = denaliTourKindFromCanonical({
        category,
        duration: durationBasics,
        eventVariant: basics?.eventVariant,
      });
      setWizardValue("basicInfo.tourType", nextSlug, { shouldDirty: true });
    },
    [basics?.category, basics?.duration, basics?.eventVariant, setWizardValue],
  );

  if (storagePath === "category") {
    return (
      <Select
        value={basics?.category ?? ""}
        onChange={(event) => {
          const value = event.target.value;
          if (!value) {
            setWizardValue("basicInfo.tourType", "", { shouldDirty: true });
            return;
          }
          applyClassification({ category: value as DenaliCanonicalCategory });
        }}
      >
        <option value="">{tDenali("selectPlaceholder")}</option>
        {CANONICAL_CATEGORY_OPTIONS.map((category) => (
          <option key={category} value={category}>
            {tDenali(`basic.categories.${category}`)}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <Select
      value={canonicalDurationFromBasics(basics?.duration)}
      onChange={(event) => {
        const value = event.target.value;
        if (!value) {
          setWizardValue("basicInfo.tourType", "", { shouldDirty: true });
          return;
        }
        applyClassification({ duration: value as DenaliCanonicalDuration });
      }}
    >
      <option value="">{tDenali("selectPlaceholder")}</option>
      {CANONICAL_DURATION_OPTIONS.map((duration) => (
        <option key={duration} value={duration}>
          {tDenali(`basic.durations.${duration}`)}
        </option>
      ))}
    </Select>
  );
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

  if (zodKind === "stringArrayDefault") {
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
    return (
      <PersianNumberInput
        numericMode="integer"
        formatThousands={DENALI_TEMPLATE_SEED_THOUSANDS_FORMAT_PATHS.has(storagePath)}
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
  setWizardValue,
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
  const fieldPath = templateSeedRhfPath(storagePath);
  const label = definition
    ? resolveDenaliRegistryFieldLabel(definition.rhfPath, tDenali)
    : storagePath;
  const seedLabel = compact ? tSettings("tourWizardTemplateSeedValueColumn") : label;

  if (!definition) {
    return (
      <FormField label={seedLabel}>
        <p className={styles.seedCompositeHint} data-testid={`denali-template-seed-unknown-${storagePath}`}>
          <code>{storagePath}</code>
        </p>
      </FormField>
    );
  }

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

  if (CLASSIFICATION_SEED_PATHS.has(storagePath)) {
    return (
      <FormField label={seedLabel} error={errorMessage}>
        <div data-testid={`denali-template-seed-${storagePath.replace(/\./g, "-")}`}>
          <TemplateClassificationSeed
            storagePath={storagePath as "category" | "duration"}
            control={control}
            setWizardValue={setWizardValue}
            tDenali={tDenali}
          />
        </div>
      </FormField>
    );
  }

  if (!fieldPath) {
    return (
      <FormField label={seedLabel}>
        <p className={styles.seedCompositeHint} data-testid={`denali-template-seed-no-rhf-${storagePath}`}>
          <code>{storagePath}</code>
        </p>
      </FormField>
    );
  }

  return (
    <Controller
      name={fieldPath as FieldPath<DenaliCreateTourWizardForm>}
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
