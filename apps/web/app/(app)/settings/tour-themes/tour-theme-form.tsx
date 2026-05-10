"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

import { Button, Checkbox, FormField, Input, Textarea } from "@tour/ui";

import formStyles from "../settings-profile-form.module.css";
import panelStyles from "../locations/locations-settings-panel.module.css";

export type TourThemeFormProps = {
  editing: SettingsTourThemeDto | null;
  onSubmit: (values: TourThemeFormParsed) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
};

export type TourThemeFormParsed = {
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number | undefined;
  isActive: boolean;
};

type TourThemeFormInput = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

export function TourThemeForm({ editing, onSubmit, onCancel, isPending }: TourThemeFormProps) {
  const t = useTranslations("settings");
  const activeId = useId();
  const activeDomId = `tour-theme-active-${activeId.replace(/:/g, "")}`;

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("tourThemesValidationName")),
        slug: z.string().trim().min(1, t("tourThemesValidationSlug")).max(120),
        description: z.string().optional(),
        sortOrder: z
          .string()
          .trim()
          .optional()
          .transform((v) => (v && v !== "" ? Number(v) : undefined))
          .refine((v) => v === undefined || !Number.isNaN(v), { message: t("tourThemesValidationSortOrder") }),
        isActive: z.boolean(),
      }),
    [t],
  );

  const resolver = useMemo(() => zodResolver(schema) as Resolver<TourThemeFormInput, unknown, TourThemeFormParsed>, [schema]);

  const form = useForm<TourThemeFormInput, unknown, TourThemeFormParsed>({
    resolver,
    defaultValues: {
      name: "",
      slug: "",
      description: "",
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
        slug: editing.slug,
        description: editing.description ?? "",
        sortOrder: String(editing.sortOrder),
        isActive: Boolean(editing.isActive),
      });
    } else {
      reset({
        name: "",
        slug: "",
        description: "",
        sortOrder: "",
        isActive: true,
      });
    }
  }, [editing, reset]);

  return (
    <form
      className={panelStyles.formBlock}
      onSubmit={handleSubmit(async (values) => {
        const descriptionTrim = values.description?.trim();
        await onSubmit({
          name: values.name.trim(),
          slug: values.slug.trim(),
          description: descriptionTrim ? descriptionTrim : null,
          sortOrder: values.sortOrder,
          isActive: values.isActive,
        });
      })}
      noValidate
    >
      <FormField
        label={t("tourThemesFieldName")}
        description={t("tourThemesFieldNameHint")}
        required
        error={errors.name?.message}
      >
        <Input autoComplete="off" aria-invalid={errors.name ? true : undefined} {...register("name")} />
      </FormField>
      <FormField
        label={t("tourThemesFieldSlug")}
        description={t("tourThemesFieldSlugHint")}
        required
        error={errors.slug?.message}
      >
        <Input autoComplete="off" aria-invalid={errors.slug ? true : undefined} {...register("slug")} />
      </FormField>
      <FormField
        label={t("tourThemesFieldDescription")}
        description={t("tourThemesFieldDescriptionHint")}
        error={errors.description?.message}
      >
        <Textarea rows={3} {...register("description")} />
      </FormField>
      <FormField label={t("tourThemesFieldSortOrder")} description={t("tourThemesFieldSortOrderHint")} error={errors.sortOrder?.message}>
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
        label={t("tourThemesFieldActive")}
        description={t("tourThemesFieldActiveHint")}
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
          {editing ? t("tourThemesSaveEdit") : t("tourThemesSaveCreate")}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onCancel}>
          {t("tourThemesCancel")}
        </Button>
      </div>
    </form>
  );
}
