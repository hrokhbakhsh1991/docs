"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { SettingsGuideLanguageDto } from "@/lib/settings-guide-languages.client";

import { Button, Checkbox, FormField, Input } from "@tour/ui";

import formStyles from "../settings-profile-form.module.css";
import panelStyles from "../locations/locations-settings-panel.module.css";

export type GuideLanguageFormProps = {
  editing: SettingsGuideLanguageDto | null;
  onSubmit: (_values: GuideLanguageFormParsed) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
};

export type GuideLanguageFormParsed = {
  name: string;
  slug: string;
  sortOrder: number | undefined;
  isActive: boolean;
};

type GuideLanguageFormInput = {
  name: string;
  slug: string;
  sortOrder: string;
  isActive: boolean;
};

export function GuideLanguageForm({ editing, onSubmit, onCancel, isPending }: GuideLanguageFormProps) {
  const t = useTranslations("settings");
  const activeId = useId();
  const activeDomId = `guide-lang-active-${activeId.replace(/:/g, "")}`;

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("guideLanguagesValidationName")),
        slug: z.string().trim().min(1, t("guideLanguagesValidationSlug")).max(120),
        sortOrder: z
          .string()
          .trim()
          .optional()
          .transform((v) => (v && v !== "" ? Number(v) : undefined))
          .refine((v) => v === undefined || !Number.isNaN(v), {
            message: t("guideLanguagesValidationSortOrder"),
          }),
        isActive: z.boolean(),
      }),
    [t],
  );

  const resolver = useMemo(
    () => zodResolver(schema) as Resolver<GuideLanguageFormInput, unknown, GuideLanguageFormParsed>,
    [schema],
  );

  const form = useForm<GuideLanguageFormInput, unknown, GuideLanguageFormParsed>({
    resolver,
    defaultValues: {
      name: "",
      slug: "",
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
        sortOrder: String(editing.sortOrder),
        isActive: Boolean(editing.isActive),
      });
    } else {
      reset({
        name: "",
        slug: "",
        sortOrder: "",
        isActive: true,
      });
    }
  }, [editing, reset]);

  return (
    <form
      className={panelStyles.formBlock}
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          name: values.name.trim(),
          slug: values.slug.trim(),
          sortOrder: values.sortOrder,
          isActive: values.isActive,
        });
      })}
      noValidate
    >
      <FormField
        label={t("guideLanguagesFieldName")}
        description={t("guideLanguagesFieldNameHint")}
        required
        error={errors.name?.message}
      >
        <Input autoComplete="off" aria-invalid={errors.name ? true : undefined} {...register("name")} />
      </FormField>
      <FormField
        label={t("guideLanguagesFieldSlug")}
        description={t("guideLanguagesFieldSlugHint")}
        required
        error={errors.slug?.message}
      >
        <Input autoComplete="off" aria-invalid={errors.slug ? true : undefined} {...register("slug")} />
      </FormField>
      <FormField
        label={t("guideLanguagesFieldSortOrder")}
        description={t("guideLanguagesFieldSortOrderHint")}
        error={errors.sortOrder?.message}
      >
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
        label={t("guideLanguagesFieldActive")}
        description={t("guideLanguagesFieldActiveHint")}
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
          {editing ? t("guideLanguagesSaveEdit") : t("guideLanguagesSaveCreate")}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onCancel}>
          {t("guideLanguagesCancel")}
        </Button>
      </div>
    </form>
  );
}
