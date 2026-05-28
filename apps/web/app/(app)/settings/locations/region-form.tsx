"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { SettingsRegionDto } from "@/lib/settings-locations-client";

import { Button, Checkbox, FormField, Input } from "@tour/ui";

import formStyles from "../settings-profile-form.module.css";
import panelStyles from "./locations-settings-panel.module.css";

export type RegionFormParsed = {
  name: string;
  country: string | null;
  sortOrder: number | undefined;
  isActive: boolean;
};

type RegionFormInput = {
  name: string;
  country: string;
  sortOrder: string;
  isActive: boolean;
};

export type RegionFormProps = {
  editing: SettingsRegionDto | null;
  onSubmit: (_values: RegionFormParsed) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
};

export function RegionForm({ editing, onSubmit, onCancel, isPending }: RegionFormProps) {
  const t = useTranslations("settings");
  const activeId = useId();
  const activeDomId = `loc-region-active-${activeId.replace(/:/g, "")}`;

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("locationsValidationRegionName")),
        country: z.string().trim().max(128, t("locationsValidationCountryMax")).optional(),
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

  const resolver = useMemo(() => zodResolver(schema) as Resolver<RegionFormInput, unknown, RegionFormParsed>, [schema]);

  const form = useForm<RegionFormInput, unknown, RegionFormParsed>({
    resolver,
    defaultValues: {
      name: "",
      country: "",
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
        country: editing.country ?? "",
        sortOrder: editing.sortOrder != null ? String(editing.sortOrder) : "",
        isActive: Boolean(editing.isActive),
      });
    } else {
      reset({
        name: "",
        country: "",
        sortOrder: "",
        isActive: true,
      });
    }
  }, [editing, reset]);

  return (
    <form
      className={panelStyles.formBlock}
      onSubmit={handleSubmit(async (values) => {
        const countryRaw = values.country;
        const countryValue =
          typeof countryRaw === "string" && countryRaw.trim() !== "" ? countryRaw.trim() : null;
        await onSubmit({
          name: values.name.trim(),
          country: countryValue,
          sortOrder: values.sortOrder,
          isActive: values.isActive,
        });
      })}
      noValidate
    >
      <FormField
        label={t("locationsRegionNameLabel")}
        description={t("locationsRegionNameHint")}
        required
        error={errors.name?.message}
      >
        <Input autoComplete="off" aria-invalid={errors.name ? true : undefined} {...register("name")} />
      </FormField>
      <FormField label={t("locationsCountryLabel")} description={t("locationsCountryHint")} error={errors.country?.message}>
        <Input autoComplete="off" {...register("country")} />
      </FormField>
      <FormField label={t("locationsSortOrderLabel")} description={t("locationsSortOrderHint")} error={errors.sortOrder?.message}>
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
          {editing ? t("locationsSaveRegionEdit") : t("locationsSaveRegionCreate")}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onCancel}>
          {t("locationsModalCancel")}
        </Button>
      </div>
    </form>
  );
}
