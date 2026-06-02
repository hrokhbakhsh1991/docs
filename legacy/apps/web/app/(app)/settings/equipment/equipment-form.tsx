"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  DENALI_CATEGORY_ENUM,
  migrateLegacyEquipmentCategory,
  normalizeCompatibleCategories,
} from "@repo/denali-domain";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { SettingsEquipmentDto } from "@/lib/settings-equipment.client";

import { Button, Checkbox, FormField, Input, Textarea } from "@tour/ui";

import { CategoryCheckboxGroup } from "./CategoryCheckboxGroup";
import formStyles from "../settings-profile-form.module.css";
import panelStyles from "../locations/locations-settings-panel.module.css";

export type EquipmentFormProps = {
  editing: SettingsEquipmentDto | null;
  onSubmit: (_values: EquipmentFormParsed) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
};

export type EquipmentFormParsed = {
  name: string;
  slug: string;
  compatibleCategories: string[];
  description: string | null;
  icon: string | null;
  sortOrder: number | undefined;
  isActive: boolean;
};

type EquipmentFormInput = {
  name: string;
  slug: string;
  compatibleCategories: string[];
  description: string;
  icon: string;
  sortOrder: string;
  isActive: boolean;
};

function resolveCompatibleCategoriesForEdit(editing: SettingsEquipmentDto): string[] {
  const fromArray = normalizeCompatibleCategories(editing.compatibleCategories);
  if (fromArray.length > 0) {
    return fromArray;
  }
  const legacy = (editing as SettingsEquipmentDto & { category?: string | null }).category;
  return migrateLegacyEquipmentCategory(legacy);
}

export function EquipmentForm({ editing, onSubmit, onCancel, isPending }: EquipmentFormProps) {
  const t = useTranslations("settings");
  const activeId = useId();
  const activeDomId = `equipment-active-${activeId.replace(/:/g, "")}`;

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("equipmentValidationName")),
        slug: z.string().trim().min(1, t("equipmentValidationSlug")).max(120),
        compatibleCategories: z.array(z.enum(DENALI_CATEGORY_ENUM)),
        description: z.string().optional(),
        icon: z.string().optional(),
        sortOrder: z
          .string()
          .trim()
          .optional()
          .transform((v) => (v && v !== "" ? Number(v) : undefined))
          .refine((v) => v === undefined || !Number.isNaN(v), { message: t("equipmentValidationSortOrder") }),
        isActive: z.boolean(),
      }),
    [t],
  );

  const resolver = useMemo(() => zodResolver(schema) as Resolver<EquipmentFormInput, unknown, EquipmentFormParsed>, [schema]);

  const form = useForm<EquipmentFormInput, unknown, EquipmentFormParsed>({
    resolver,
    defaultValues: {
      name: "",
      slug: "",
      compatibleCategories: [],
      description: "",
      icon: "",
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
        compatibleCategories: resolveCompatibleCategoriesForEdit(editing),
        description: editing.description ?? "",
        icon: editing.icon ?? "",
        sortOrder: String(editing.sortOrder),
        isActive: Boolean(editing.isActive),
      });
    } else {
      reset({
        name: "",
        slug: "",
        compatibleCategories: [],
        description: "",
        icon: "",
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
        const iconTrim = values.icon?.trim();
        await onSubmit({
          name: values.name.trim(),
          slug: values.slug.trim(),
          compatibleCategories: normalizeCompatibleCategories(values.compatibleCategories),
          description: descriptionTrim ? descriptionTrim : null,
          icon: iconTrim ? iconTrim : null,
          sortOrder: values.sortOrder,
          isActive: values.isActive,
        });
      })}
      noValidate
    >
      <FormField
        label={t("equipmentFieldName")}
        description={t("equipmentFieldNameHint")}
        required
        error={errors.name?.message}
      >
        <Input autoComplete="off" aria-invalid={errors.name ? true : undefined} {...register("name")} />
      </FormField>
      <FormField
        label={t("equipmentFieldSlug")}
        description={t("equipmentFieldSlugHint")}
        required
        error={errors.slug?.message}
      >
        <Input autoComplete="off" aria-invalid={errors.slug ? true : undefined} {...register("slug")} />
      </FormField>
      <FormField
        label={t("equipmentFieldCompatibleCategories")}
        description={t("equipmentFieldCompatibleCategoriesHint")}
        error={errors.compatibleCategories?.message}
      >
        <Controller
          control={control}
          name="compatibleCategories"
          render={({ field }) => (
            <CategoryCheckboxGroup
              value={field.value ?? []}
              onChange={field.onChange}
              disabled={isPending}
            />
          )}
        />
      </FormField>
      <FormField
        label={t("equipmentFieldDescription")}
        description={t("equipmentFieldDescriptionHint")}
        error={errors.description?.message}
      >
        <Textarea rows={3} {...register("description")} />
      </FormField>
      <FormField label={t("equipmentFieldIcon")} description={t("equipmentFieldIconHint")} error={errors.icon?.message}>
        <Input autoComplete="off" {...register("icon")} placeholder={t("equipmentFieldIconPlaceholder")} />
      </FormField>
      <FormField label={t("equipmentFieldSortOrder")} description={t("equipmentFieldSortOrderHint")} error={errors.sortOrder?.message}>
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
        label={t("equipmentFieldActive")}
        description={t("equipmentFieldActiveHint")}
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
          {editing ? t("equipmentSaveEdit") : t("equipmentSaveCreate")}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onCancel}>
          {t("equipmentCancel")}
        </Button>
      </div>
    </form>
  );
}
