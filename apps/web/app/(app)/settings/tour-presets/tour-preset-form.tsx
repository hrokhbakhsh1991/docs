"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { buildDuplicatePresetName, deepClonePresetDefaults } from "@/lib/tour-preset-duplicate";
import type { SettingsTourPresetDto } from "@/lib/settings-tour-presets.client";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { Button, Checkbox, FormField, Input, Textarea } from "@tour/ui";

import formStyles from "../settings-profile-form.module.css";
import panelStyles from "../locations/locations-settings-panel.module.css";

/** Sample JSON cannot live in ICU messages: `{`/`}` are parsed as placeholders (`MALFORMED_ARGUMENT`). */
const DEFAULTS_JSON_TEXTAREA_PLACEHOLDER = `{
  "overview": {
    "tourType": "mountain",
    "mainTourThemeId": "uuid..."
  },
  "policies": {
    "cancellationPolicy": "..."
  }
}`;

export type TourPresetFormProps = {
  editing: SettingsTourPresetDto | null;
  duplicateFrom?: SettingsTourPresetDto | null;
  existingPresetNames?: string[];
  duplicateSortOrder?: number;
  onSubmit: (values: TourPresetFormParsed) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
};

export type TourPresetFormParsed = {
  name: string;
  description: string | null;
  sortOrder: number | undefined;
  isActive: boolean;
  defaults: Record<string, unknown>;
};

type TourPresetFormInput = {
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
  defaultsJson: string;
};

function parseDefaultsJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  const parsed: unknown = JSON.parse(trimmed);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("INVALID_DEFAULTS_OBJECT");
  }
  return parsed as Record<string, unknown>;
}

export function TourPresetForm({
  editing,
  duplicateFrom = null,
  existingPresetNames = [],
  duplicateSortOrder,
  onSubmit,
  onCancel,
  isPending,
}: TourPresetFormProps) {
  const t = useTranslations("settings");
  const activeId = useId();
  const activeDomId = `tour-preset-active-${activeId.replace(/:/g, "")}`;

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("tourPresetsValidationName")),
        description: z.string().optional(),
        sortOrder: z.string().refine((v) => !v.trim() || !Number.isNaN(Number(v.trim())), {
          message: t("tourPresetsValidationSortOrder"),
        }),
        isActive: z.boolean(),
        defaultsJson: z
          .string()
          .default("")
          .superRefine((val, ctx) => {
            try {
              const trimmed = val.trim();
              if (!trimmed) {
                return;
              }
              parseDefaultsJson(trimmed);
            } catch {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("tourPresetsValidationDefaultsJson") });
            }
          }),
      }),
    [t],
  );

  const resolver = useMemo(() => zodResolver(schema) as Resolver<TourPresetFormInput>, [schema]);

  const form = useForm<TourPresetFormInput>({
    resolver,
    defaultValues: {
      name: "",
      description: "",
      sortOrder: "",
      isActive: true,
      defaultsJson: "",
    },
  });

  const { register, control, handleSubmit, reset, formState } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        description: editing.description ?? "",
        sortOrder: editing.sortOrder !== undefined ? String(editing.sortOrder) : "",
        isActive: editing.isActive,
        defaultsJson:
          editing.defaults && Object.keys(editing.defaults).length > 0
            ? JSON.stringify(editing.defaults, null, 2)
            : "",
      });
    } else if (duplicateFrom) {
      const defaultsCopy = deepClonePresetDefaults(duplicateFrom.defaults ?? {});
      reset({
        name: buildDuplicatePresetName(duplicateFrom.name, t("tourPresetsCopySuffix"), existingPresetNames),
        description: duplicateFrom.description ?? "",
        sortOrder: duplicateSortOrder != null ? String(duplicateSortOrder) : "",
        isActive: duplicateFrom.isActive,
        defaultsJson: Object.keys(defaultsCopy).length > 0 ? JSON.stringify(defaultsCopy, null, 2) : "",
      });
    } else {
      reset({
        name: "",
        description: "",
        sortOrder: "",
        isActive: true,
        defaultsJson: "",
      });
    }
  }, [duplicateFrom, duplicateSortOrder, editing, existingPresetNames, reset, t]);

  return (
    <form
      className={panelStyles.formBlock}
      onSubmit={handleSubmit(async (values) => {
        const descriptionTrim = values.description?.trim();
        let defaults: Record<string, unknown> = {};
        try {
          defaults = parseDefaultsJson(values.defaultsJson ?? "");
        } catch {
          defaults = {};
        }
        const sortStr = values.sortOrder?.trim() ?? "";
        const sortOrder =
          sortStr !== "" && !Number.isNaN(Number(sortStr)) ? Number(sortStr) : undefined;
        const parsed: TourPresetFormParsed = {
          name: values.name.trim(),
          description: descriptionTrim ? descriptionTrim : null,
          sortOrder,
          isActive: values.isActive,
          defaults,
        };
        await onSubmit(parsed);
      })}
      noValidate
    >
      <FormField label={t("tourPresetsFieldName")} description={t("tourPresetsFieldNameHint")} error={errors.name?.message}>
        <Input type="text" {...register("name")} autoComplete="off" aria-invalid={errors.name ? true : undefined} />
      </FormField>

      <FormField
        label={t("tourPresetsFieldDescription")}
        description={t("tourPresetsFieldDescriptionHint")}
        error={errors.description?.message}
      >
        <Textarea rows={2} {...register("description")} />
      </FormField>

      <FormField label={t("tourPresetsFieldSortOrder")} description={t("tourPresetsFieldSortOrderHint")} error={errors.sortOrder?.message}>
        <Controller
          control={control}
          name="sortOrder"
          render={({ field }) => (
            <PersianNumberInput
              numericMode="integer"
              autoComplete="off"
              aria-invalid={errors.sortOrder ? true : undefined}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="0"
            />
          )}
        />
      </FormField>

      <FormField htmlFor={activeDomId} label={t("tourPresetsFieldActive")} description={t("tourPresetsFieldActiveHint")}>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Checkbox
              bare
              id={activeDomId}
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            />
          )}
        />
      </FormField>

      <FormField
        label={t("tourPresetsFieldDefaultsJson")}
        description={t("tourPresetsFieldDefaultsJsonHint")}
        error={errors.defaultsJson?.message}
      >
        <Textarea
          rows={12}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}
          placeholder={DEFAULTS_JSON_TEXTAREA_PLACEHOLDER}
          {...register("defaultsJson")}
          aria-invalid={errors.defaultsJson ? true : undefined}
        />
      </FormField>

      <div className={formStyles.actions}>
        <Button type="submit" variant="primary" loading={isPending} disabled={isPending}>
          {editing ? t("tourPresetsSaveEdit") : t("tourPresetsSaveCreate")}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onCancel}>
          {t("tourPresetsCancel")}
        </Button>
      </div>
    </form>
  );
}
