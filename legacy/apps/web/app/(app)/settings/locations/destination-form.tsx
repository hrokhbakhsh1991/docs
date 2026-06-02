"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { SettingsDestinationDto, SettingsRegionDto } from "@/lib/settings-locations-client";

import { Button, Checkbox, FormField, Input, Select } from "@tour/ui";

import formStyles from "../settings-profile-form.module.css";
import panelStyles from "./locations-settings-panel.module.css";

export type DestinationFormParsed = {
  name: string;
  regionId: string;
  type: string | null;
  altitudeM: number | null;
  sortOrder: number | undefined;
  isActive: boolean;
};

type DestinationFormInput = {
  name: string;
  regionId: string;
  type: string;
  altitudeM: string;
  sortOrder: string;
  isActive: boolean;
};

export type DestinationFormProps = {
  editing: SettingsDestinationDto | null;
  /** When `editing` is null, pre-select this region in the dropdown. */
  defaultRegionIdWhenCreating: string;
  allRegions: SettingsRegionDto[];
  onSubmit: (_values: DestinationFormParsed) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
};

export function DestinationForm({
  editing,
  defaultRegionIdWhenCreating,
  allRegions,
  onSubmit,
  onCancel,
  isPending,
}: DestinationFormProps) {
  const t = useTranslations("settings");
  const activeId = useId();
  const activeDomId = `loc-destination-active-${activeId.replace(/:/g, "")}`;

  const activeRegions = useMemo(() => allRegions.filter((r) => r.isActive), [allRegions]);

  const regionSelectOptions = useMemo(() => {
    if (!editing) {
      return activeRegions;
    }
    const destRegionId = editing.regionId;
    const has = activeRegions.some((r) => r.id === destRegionId);
    if (has) {
      return activeRegions;
    }
    const inactive = allRegions.find((r) => r.id === destRegionId);
    return inactive ? [...activeRegions, inactive] : activeRegions;
  }, [activeRegions, allRegions, editing]);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("locationsValidationDestinationName")),
        regionId: z.string().min(1, t("locationsValidationPickRegion")),
        type: z.string().optional(),
        altitudeM: z
          .string()
          .trim()
          .optional()
          .transform((v) => (v && v !== "" ? Number(v) : undefined))
          .refine((v) => v === undefined || !Number.isNaN(v), {
            message: t("locationsValidationAltitudeNumber"),
          }),
        sortOrder: z
          .string()
          .trim()
          .optional()
          .transform((v) => (v && v !== "" ? Number(v) : undefined))
          .refine((v) => v === undefined || !Number.isNaN(v), {
            message: t("locationsValidationOrderNumber"),
          }),
        isActive: z.boolean(),
      }),
    [t],
  );

  const resolver = useMemo(
    () => zodResolver(schema) as Resolver<DestinationFormInput, unknown, DestinationFormParsed>,
    [schema],
  );

  const form = useForm<DestinationFormInput, unknown, DestinationFormParsed>({
    resolver,
    defaultValues: {
      name: "",
      regionId: "",
      type: "",
      altitudeM: "",
      sortOrder: "",
      isActive: true,
    },
  });

  const { register, control, handleSubmit, reset, formState } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        regionId: editing.regionId,
        type: editing.type ?? "",
        altitudeM: editing.altitudeM != null ? String(editing.altitudeM) : "",
        sortOrder: editing.sortOrder != null ? String(editing.sortOrder) : "",
        isActive: Boolean(editing.isActive),
      });
    } else {
      reset({
        name: "",
        regionId: defaultRegionIdWhenCreating,
        type: "",
        altitudeM: "",
        sortOrder: "",
        isActive: true,
      });
    }
  }, [defaultRegionIdWhenCreating, editing, reset]);

  return (
    <form
      className={panelStyles.formBlock}
      onSubmit={handleSubmit(async (values) => {
        const altitude =
          typeof values.altitudeM === "number" && !Number.isNaN(values.altitudeM) ? values.altitudeM : undefined;
        await onSubmit({
          name: values.name.trim(),
          regionId: values.regionId,
          type: values.type && values.type !== "" ? values.type : null,
          altitudeM: altitude ?? null,
          sortOrder: values.sortOrder,
          isActive: values.isActive,
        });
      })}
      noValidate
    >
      <FormField
        label={t("locationsDestinationNameLabel")}
        description={t("locationsDestinationNameHint")}
        required
        error={errors.name?.message}
      >
        <Input autoComplete="off" aria-invalid={errors.name ? true : undefined} {...register("name")} />
      </FormField>
      <FormField
        label={t("locationsDestinationRegionLabel")}
        description={t("locationsDestinationRegionHint")}
        required
        error={errors.regionId?.message}
      >
        <Select invalid={Boolean(errors.regionId)} {...register("regionId")} disabled={allRegions.length === 0}>
          <option value="">{t("locationsPickRegionPlaceholder")}</option>
          {regionSelectOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {!r.isActive ? ` (${t("locationsInactiveBadge")})` : ""}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={t("locationsDestinationTypeLabel")} error={errors.type?.message}>
        <Select invalid={Boolean(errors.type)} {...register("type")}>
          <option value="">{t("locationsTypePlaceholder")}</option>
          <option value="CITY">{t("locationsTypeCity")}</option>
          <option value="MOUNTAIN">{t("locationsTypeMountain")}</option>
          <option value="LAKE">{t("locationsTypeLake")}</option>
          <option value="OTHER">{t("locationsTypeOther")}</option>
        </Select>
      </FormField>
      <FormField label={t("locationsAltitudeLabel")} description={t("locationsAltitudeHint")} error={errors.altitudeM?.message}>
        <Controller
          control={control}
          name="altitudeM"
          render={({ field }) => (
            <PersianNumberInput
              autoComplete="off"
              aria-invalid={errors.altitudeM ? true : undefined}
              numericMode="integer"
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
      </FormField>
      <FormField label={t("locationsDestinationSortLabel")} error={errors.sortOrder?.message}>
        <Controller
          control={control}
          name="sortOrder"
          render={({ field }) => (
            <PersianNumberInput
              autoComplete="off"
              aria-invalid={errors.sortOrder ? true : undefined}
              numericMode="integer"
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
      </FormField>
      <FormField
        htmlFor={activeDomId}
        label={t("locationsActiveLabel")}
        description={t("locationsActiveHint")}
        error={errors.isActive?.message}
      >
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Checkbox
              bare
              id={activeDomId}
              name={field.name}
              ref={field.ref}
              checked={field.value}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
      </FormField>
      <div className={formStyles.actions}>
        <Button type="submit" variant="primary" loading={isPending} disabled={isPending}>
          {editing ? t("locationsSaveDestinationEdit") : t("locationsSaveDestinationCreate")}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onCancel}>
          {t("locationsModalCancel")}
        </Button>
      </div>
    </form>
  );
}
