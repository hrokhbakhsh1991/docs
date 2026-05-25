"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { TOUR_TYPES, TOUR_FORM_PROFILE_VALUES, type TourFormProfile } from "@repo/types";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import { Controller, useForm, type Control } from "react-hook-form";
import { z } from "zod";

import {
  DIFFICULTY_LEVELS,
  EXPERIENCE_LEVELS,
  GENDER_RESTRICTIONS,
} from "@/features/tours/models/tourTripDetails.schema";
import { buildDuplicatePresetName, deepClonePresetDefaults } from "@/lib/tour-preset-duplicate";
import type { SettingsTourPresetDto } from "@/lib/settings-tour-presets.client";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

import {
  EXPERIENCE_LEVEL_LABELS,
  FITNESS_LEVEL_LABELS,
  GENDER_RESTRICTION_LABELS,
} from "@/features/tours/wizard/participationLabels";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { useSettingsEquipment } from "@/hooks/use-settings-equipment";
import { Button, Checkbox, FormField, Input, Select, Textarea } from "@tour/ui";

import type { TourPresetFormParsed } from "../tour-presets/tour-preset-form";
import formStyles from "../settings-profile-form.module.css";
import panelStyles from "../locations/locations-settings-panel.module.css";

import {
  defaultsRecordToSimpleFields,
  emptyTourPresetSimpleFields,
  simpleFieldsToDefaultsPayload,
  type TourPresetSimpleFields,
} from "./tour-preset-defaults-map";

const POLICY_KEYS = [
  "cancellationPolicy",
  "refundPolicy",
  "attendanceRules",
  "lateArrivalPolicy",
  "noShowPolicy",
  "confirmationPolicy",
  "capacityPolicy",
  "weatherPolicy",
  "safetyNotes",
  "riskDisclaimer",
  "safetyPolicy",
  "reservationRules",
] as const;

type PolicyKey = (typeof POLICY_KEYS)[number];

function policiesZodObject() {
  const shape = POLICY_KEYS.reduce(
    (acc, k) => {
      acc[k] = z.string();
      return acc;
    },
    {} as Record<PolicyKey, z.ZodString>,
  );
  return z.object(shape);
}

function createTourPresetSimpleSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, t("tourFormDefaultsValidationName")),
    description: z.string().optional(),
    sortOrder: z.string().refine((v) => !v.trim() || !Number.isNaN(Number(v.trim())), {
      message: t("tourPresetsValidationSortOrder"),
    }),
    isActive: z.boolean(),
    formProfile: z.enum(TOUR_FORM_PROFILE_VALUES),
    policies: policiesZodObject(),
    participation: z.object({
      sportsInsuranceRequired: z.boolean(),
      registrationNationalIdRequired: z.boolean(),
      requiredExperienceLevel: z.string(),
      requiredFitnessLevel: z.string(),
      genderRestriction: z.string(),
      minimumAge: z.string(),
      maximumAge: z.string(),
      minParticipants: z.string(),
      technicalSkillRequired: z.string(),
      medicalRestrictions: z.string(),
      requirements: z.string(),
      skillsRequiredLines: z.string(),
      documentsRequiredLines: z.string(),
      suitableForLines: z.string(),
      notSuitableForLines: z.string(),
      gearRequiredIds: z.array(z.string()),
      gearOptionalIds: z.array(z.string()),
    }),
    logistics: z.object({
      primaryTransportMode: z.string(),
      fuelShareToman: z.string(),
      leaderProvidesInsurance: z.boolean(),
      leaderInsuranceNotes: z.string(),
      includedServices: z.string(),
      excludedServices: z.string(),
      meetingPointDetails: z.string(),
      transportationDetails: z.string(),
      transportationNotes: z.string(),
      accommodationDetails: z.string(),
      accommodationNotes: z.string(),
      mealPlan: z.string(),
      mealNotes: z.string(),
      supportServicesLines: z.string(),
      optionalServicesLines: z.string(),
    }),
    overview: z.object({
      tourType: z.string(),
      mainTourThemeId: z.string(),
      shortDescription: z.string(),
      longDescription: z.string(),
      highlightsLines: z.string(),
      communicationLink: z.string(),
    }),
    schedule: z.object({
      departureMeetingTime: z.string(),
      returnMeetingTime: z.string(),
    }),
    location: z.object({
      meetingPoint: z.string(),
      returnPoint: z.string(),
      displayLocation: z.string(),
    }),
    autoAcceptRegistrations: z.boolean(),
  });
}

type SimplePresetFormValues = z.infer<ReturnType<typeof createTourPresetSimpleSchema>>;

const detailsStyle = { marginBottom: "1rem" } as const;
const summaryStyle = { cursor: "pointer", fontWeight: 600, marginBottom: "0.5rem" } as const;

const mutedSectionIntro = {
  fontSize: "0.8125rem",
  color: "var(--color-neutral-600, #525252)",
  margin: "0 0 0.65rem",
  lineHeight: 1.55,
} as const;

function PresetEquipmentIdsField({
  control,
  name,
  label,
  description,
  disabled,
  t,
}: {
  control: Control<SimplePresetFormValues>;
  name: "participation.gearRequiredIds" | "participation.gearOptionalIds";
  label: string;
  description?: string;
  disabled?: boolean;
  t: (key: string) => string;
}) {
  const equipmentQuery = useSettingsEquipment();
  const items = (equipmentQuery.data ?? []).filter((row) => row.isActive).map((row) => ({ id: row.id, name: row.name }));

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const raw = Array.isArray(field.value) ? (field.value as string[]) : [];
        const selected = new Set(raw);
        const toggle = (id: string) => {
          const next = new Set(selected);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          const ordered = items.map((row) => row.id).filter((rowId) => next.has(rowId));
          field.onChange(ordered);
        };

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{label}</span>
            {description ? <p style={{ ...mutedSectionIntro, margin: 0 }}>{description}</p> : null}
            {equipmentQuery.isLoading ? <p style={{ ...mutedSectionIntro, margin: 0 }}>{t("tourFormDefaults_equipmentLoading")}</p> : null}
            {!equipmentQuery.isLoading && equipmentQuery.isError ? (
              <p style={{ color: "var(--color-danger-600, #b91c1c)", fontSize: "0.875rem", margin: 0 }} role="alert">
                {t("tourFormDefaults_equipmentLoadError")}
              </p>
            ) : null}
            {!equipmentQuery.isLoading && !equipmentQuery.isError && items.length === 0 ? (
              <p style={{ ...mutedSectionIntro, margin: 0 }}>{t("tourFormDefaults_equipmentEmptyCatalog")}</p>
            ) : null}
            {!equipmentQuery.isLoading && !equipmentQuery.isError && items.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }} role="group" aria-label={label}>
                {items.map((row) => (
                  <Checkbox key={row.id} label={row.name} checked={selected.has(row.id)} disabled={disabled} onChange={() => toggle(row.id)} />
                ))}
              </div>
            ) : null}
          </div>
        );
      }}
    />
  );
}

export type TourPresetSimpleFormProps = {
  editing: SettingsTourPresetDto | null;
  duplicateFrom?: SettingsTourPresetDto | null;
  existingPresetNames?: string[];
  duplicateSortOrder?: number;
  themeCatalog: SettingsTourThemeDto[];
  onSubmit: (values: TourPresetFormParsed) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
};

export function TourPresetSimpleForm({
  editing,
  duplicateFrom = null,
  existingPresetNames = [],
  duplicateSortOrder,
  themeCatalog,
  onSubmit,
  onCancel,
  isPending,
}: TourPresetSimpleFormProps) {
  const t = useTranslations("settings");
  const activeId = useId();
  const activeDomId = `tour-simple-preset-active-${activeId.replace(/:/g, "")}`;

  const themeOptions = useMemo(
    () => themeCatalog.filter((row) => row.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [themeCatalog],
  );

  const defaultValues = useMemo((): SimplePresetFormValues => {
    const inner = emptyTourPresetSimpleFields();
    return {
      name: "",
      description: "",
      sortOrder: "",
      isActive: true,
      formProfile: "general",
      ...inner,
    };
  }, []);

  const schema = useMemo(() => createTourPresetSimpleSchema(t), [t]);

  const form = useForm<SimplePresetFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
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
        formProfile: (editing.formProfile as TourFormProfile) ?? "general",
        ...defaultsRecordToSimpleFields(editing.defaults),
      });
    } else if (duplicateFrom) {
      const defaultsCopy = deepClonePresetDefaults(duplicateFrom.defaults ?? {});
      reset({
        name: buildDuplicatePresetName(duplicateFrom.name, t("tourPresetsCopySuffix"), existingPresetNames),
        description: duplicateFrom.description ?? "",
        sortOrder: duplicateSortOrder != null ? String(duplicateSortOrder) : "",
        isActive: duplicateFrom.isActive,
        formProfile: (duplicateFrom.formProfile as TourFormProfile) ?? "general",
        ...defaultsRecordToSimpleFields(defaultsCopy),
      });
    } else {
      reset(defaultValues);
    }
  }, [defaultValues, duplicateFrom, duplicateSortOrder, editing, existingPresetNames, reset, t]);

  return (
    <form
      className={panelStyles.formBlock}
      onSubmit={handleSubmit(async (values) => {
        const sortStr = values.sortOrder?.trim() ?? "";
        const sortOrder =
          sortStr !== "" && !Number.isNaN(Number(sortStr)) ? Number(sortStr) : undefined;
        const inner: TourPresetSimpleFields = {
          policies: values.policies,
          participation: values.participation,
          logistics: values.logistics,
          overview: values.overview,
          schedule: values.schedule,
          location: values.location,
          autoAcceptRegistrations: values.autoAcceptRegistrations,
        };
        const defaults = simpleFieldsToDefaultsPayload(inner);
        const descriptionTrim = values.description?.trim();
        const parsed: TourPresetFormParsed = {
          name: values.name.trim(),
          description: descriptionTrim ? descriptionTrim : null,
          sortOrder,
          isActive: values.isActive,
          formProfile: values.formProfile,
          defaults,
        };
        await onSubmit(parsed);
      })}
      noValidate
    >
      <FormField label={t("tourFormDefaults_fieldName")} description={t("tourFormDefaults_fieldNameHint")} error={errors.name?.message}>
        <Input type="text" {...register("name")} autoComplete="off" aria-invalid={errors.name ? true : undefined} />
      </FormField>

      <FormField
        label={t("tourPresetsFieldDescription")}
        description={t("tourFormDefaults_fieldInternalNoteHint")}
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
            <Checkbox bare id={activeDomId} checked={field.value} onChange={(e) => field.onChange(e.target.checked)} onBlur={field.onBlur} ref={field.ref} name={field.name} />
          )}
        />
      </FormField>

      <FormField
        label={t("tourPresetsFieldFormProfile")}
        description={t("tourPresetsFieldFormProfileHint")}
        error={errors.formProfile?.message}
      >
        <Controller
          control={control}
          name="formProfile"
          render={({ field }) => (
            <Select
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value as TourFormProfile)}
              aria-invalid={errors.formProfile ? true : undefined}
            >
              {TOUR_FORM_PROFILE_VALUES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          )}
        />
      </FormField>

      <FormField label={t("tourFormDefaults_fieldAutoAccept")} description={t("tourFormDefaults_fieldAutoAcceptHint")}>
        <Controller
          control={control}
          name="autoAcceptRegistrations"
          render={({ field }) => (
            <Checkbox
              label={t("tourFormDefaults_fieldAutoAcceptCheckbox")}
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            />
          )}
        />
      </FormField>

      <details style={detailsStyle}>
        <summary style={summaryStyle}>{t("tourFormDefaults_sectionOverview")}</summary>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <p style={mutedSectionIntro}>{t("tourFormDefaults_sectionOverviewIntro")}</p>
          <FormField
            label={t("tourPresetsDefaultsTourType")}
            description={t("tourPresetsDefaultsTourTypeHint")}
            error={errors.overview?.tourType?.message}
          >
            <Controller
              control={control}
              name="overview.tourType"
              render={({ field }) => (
                <Select name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)}>
                  <option value="">{t("tourPresetsMatchNone")}</option>
                  {TOUR_TYPES.map((tt) => (
                    <option key={tt} value={tt}>
                      {t(`tourPresetsTourType_${tt}` as never)}
                    </option>
                  ))}
                </Select>
              )}
            />
          </FormField>
          <FormField
            label={t("tourPresetsDefaultsMainTheme")}
            description={t("tourPresetsDefaultsMainThemeHint")}
            error={errors.overview?.mainTourThemeId?.message}
          >
            <Controller
              control={control}
              name="overview.mainTourThemeId"
              render={({ field }) => (
                <Select name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)}>
                  <option value="">{t("tourPresetsMatchNone")}</option>
                  {themeOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_overview_shortDescription")} description={t("tourFormDefaults_overview_shortDescription_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_overview_shortDescription_placeholder")} {...register("overview.shortDescription")} />
          </FormField>
          <FormField label={t("tourFormDefaults_overview_longDescription")} description={t("tourFormDefaults_overview_longDescription_hint")}>
            <Textarea rows={4} placeholder={t("tourFormDefaults_overview_longDescription_placeholder")} {...register("overview.longDescription")} />
          </FormField>
          <FormField label={t("tourFormDefaults_overview_highlights")} description={t("tourFormDefaults_overview_highlights_hint")}>
            <Textarea rows={3} placeholder={t("tourFormDefaults_overview_highlights_placeholder")} {...register("overview.highlightsLines")} />
          </FormField>
          <FormField label={t("tourFormDefaults_overview_communicationLink")} description={t("tourFormDefaults_overview_communicationLink_hint")}>
            <Input type="text" inputMode="url" placeholder={t("tourFormDefaults_overview_communicationLink_placeholder")} {...register("overview.communicationLink")} />
          </FormField>
        </div>
      </details>

      <details style={detailsStyle}>
        <summary style={summaryStyle}>{t("tourFormDefaults_sectionScheduleLocation")}</summary>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <p style={mutedSectionIntro}>{t("tourFormDefaults_sectionScheduleLocationIntro")}</p>
          <FormField label={t("tourFormDefaults_schedule_departure")} description={t("tourFormDefaults_schedule_departure_hint")}>
            <Input type="text" placeholder={t("tourFormDefaults_schedule_time_placeholder")} {...register("schedule.departureMeetingTime")} />
          </FormField>
          <FormField label={t("tourFormDefaults_schedule_return")} description={t("tourFormDefaults_schedule_return_hint")}>
            <Input type="text" placeholder={t("tourFormDefaults_schedule_time_placeholder")} {...register("schedule.returnMeetingTime")} />
          </FormField>
          <FormField label={t("tourFormDefaults_location_meetingPoint")} description={t("tourFormDefaults_location_meetingPoint_hint")}>
            <Input type="text" placeholder={t("tourFormDefaults_location_meetingPoint_placeholder")} {...register("location.meetingPoint")} />
          </FormField>
          <FormField label={t("tourFormDefaults_location_returnPoint")} description={t("tourFormDefaults_location_returnPoint_hint")}>
            <Input type="text" placeholder={t("tourFormDefaults_location_returnPoint_placeholder")} {...register("location.returnPoint")} />
          </FormField>
          <FormField label={t("tourFormDefaults_location_display")} description={t("tourFormDefaults_location_display_hint")}>
            <Input type="text" placeholder={t("tourFormDefaults_location_display_placeholder")} {...register("location.displayLocation")} />
          </FormField>
        </div>
      </details>

      <details style={detailsStyle}>
        <summary style={summaryStyle}>{t("tourFormDefaults_sectionPolicies")}</summary>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <p style={mutedSectionIntro}>{t("tourFormDefaults_sectionPoliciesIntro")}</p>
          {POLICY_KEYS.map((key: PolicyKey) => (
            <FormField
              key={key}
              label={t(`tourFormDefaults_policy_${key}` as never)}
              description={t(`tourFormDefaults_policy_${key}_hint` as never)}
            >
              <Textarea
                rows={key === "cancellationPolicy" || key === "refundPolicy" ? 4 : 3}
                placeholder={t(`tourFormDefaults_policy_${key}_placeholder` as never)}
                {...register(`policies.${key}`)}
              />
            </FormField>
          ))}
        </div>
      </details>

      <details style={detailsStyle}>
        <summary style={summaryStyle}>{t("tourFormDefaults_sectionParticipation")}</summary>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <p style={mutedSectionIntro}>{t("tourFormDefaults_sectionParticipationIntro")}</p>
          <FormField label={t("tourFormDefaults_participation_sportsInsurance")} description={t("tourFormDefaults_participation_sportsInsurance_hint")}>
            <Controller
              control={control}
              name="participation.sportsInsuranceRequired"
              render={({ field }) => (
                <Checkbox label={t("tourFormDefaults_participation_sportsInsuranceCheckbox")} checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_nationalId")} description={t("tourFormDefaults_participation_nationalId_hint")}>
            <Controller
              control={control}
              name="participation.registrationNationalIdRequired"
              render={({ field }) => (
                <Checkbox label={t("tourFormDefaults_participation_nationalIdCheckbox")} checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_experience")} description={t("tourFormDefaults_participation_experience_hint")}>
            <Controller
              control={control}
              name="participation.requiredExperienceLevel"
              render={({ field }) => (
                <Select value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)}>
                  <option value="">{t("tourFormDefaults_selectOptional")}</option>
                  {EXPERIENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {EXPERIENCE_LEVEL_LABELS[level]}
                    </option>
                  ))}
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_fitness")} description={t("tourFormDefaults_participation_fitness_hint")}>
            <Controller
              control={control}
              name="participation.requiredFitnessLevel"
              render={({ field }) => (
                <Select value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)}>
                  <option value="">{t("tourFormDefaults_selectOptional")}</option>
                  {DIFFICULTY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {FITNESS_LEVEL_LABELS[level]}
                    </option>
                  ))}
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_gender")} description={t("tourFormDefaults_participation_gender_hint")}>
            <Controller
              control={control}
              name="participation.genderRestriction"
              render={({ field }) => (
                <Select value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)}>
                  <option value="">{t("tourFormDefaults_selectOptional")}</option>
                  {GENDER_RESTRICTIONS.map((g) => (
                    <option key={g} value={g}>
                      {GENDER_RESTRICTION_LABELS[g]}
                    </option>
                  ))}
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_minAge")} description={t("tourFormDefaults_participation_minAge_hint")}>
            <Controller
              control={control}
              name="participation.minimumAge"
              render={({ field }) => (
                <PersianNumberInput
                  numericMode="integer"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder={t("tourFormDefaults_participation_minAge_placeholder")}
                />
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_maxAge")} description={t("tourFormDefaults_participation_maxAge_hint")}>
            <Controller
              control={control}
              name="participation.maximumAge"
              render={({ field }) => (
                <PersianNumberInput
                  numericMode="integer"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder={t("tourFormDefaults_participation_maxAge_placeholder")}
                />
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_minParticipants")} description={t("tourFormDefaults_participation_minParticipants_hint")}>
            <Controller
              control={control}
              name="participation.minParticipants"
              render={({ field }) => (
                <PersianNumberInput
                  numericMode="integer"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder={t("tourFormDefaults_participation_minParticipants_placeholder")}
                />
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_technical")} description={t("tourFormDefaults_participation_technical_hint")}>
            <Input type="text" placeholder={t("tourFormDefaults_participation_technical_placeholder")} {...register("participation.technicalSkillRequired")} />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_medical")} description={t("tourFormDefaults_participation_medical_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_participation_medical_placeholder")} {...register("participation.medicalRestrictions")} />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_requirements")} description={t("tourFormDefaults_participation_requirements_hint")}>
            <Textarea rows={3} placeholder={t("tourFormDefaults_participation_requirements_placeholder")} {...register("participation.requirements")} />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_skills")} description={t("tourFormDefaults_participation_skills_hint")}>
            <Textarea rows={3} placeholder={t("tourFormDefaults_participation_skills_placeholder")} {...register("participation.skillsRequiredLines")} />
          </FormField>
          <PresetEquipmentIdsField
            control={control}
            name="participation.gearRequiredIds"
            label={t("tourFormDefaults_participation_gearRequired_label")}
            description={t("tourFormDefaults_participation_gearRequired_hint")}
            disabled={isPending}
            t={t}
          />
          <PresetEquipmentIdsField
            control={control}
            name="participation.gearOptionalIds"
            label={t("tourFormDefaults_participation_gearOptional_label")}
            description={t("tourFormDefaults_participation_gearOptional_hint")}
            disabled={isPending}
            t={t}
          />
          <FormField label={t("tourFormDefaults_participation_documents")} description={t("tourFormDefaults_participation_documents_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_participation_documents_placeholder")} {...register("participation.documentsRequiredLines")} />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_suitable")} description={t("tourFormDefaults_participation_suitable_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_participation_suitable_placeholder")} {...register("participation.suitableForLines")} />
          </FormField>
          <FormField label={t("tourFormDefaults_participation_notSuitable")} description={t("tourFormDefaults_participation_notSuitable_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_participation_notSuitable_placeholder")} {...register("participation.notSuitableForLines")} />
          </FormField>
        </div>
      </details>

      <details style={detailsStyle}>
        <summary style={summaryStyle}>{t("tourFormDefaults_sectionLogistics")}</summary>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <p style={mutedSectionIntro}>{t("tourFormDefaults_sectionLogisticsIntro")}</p>
          <FormField label={t("tourFormDefaults_logistics_transport")} description={t("tourFormDefaults_logistics_transport_hint")}>
            <Controller
              control={control}
              name="logistics.primaryTransportMode"
              render={({ field }) => (
                <Select value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)}>
                  <option value="">{t("tourFormDefaults_selectOptional")}</option>
                  <option value="plane">{t("tourFormDefaults_transport_plane")}</option>
                  <option value="train">{t("tourFormDefaults_transport_train")}</option>
                  <option value="bus">{t("tourFormDefaults_transport_bus")}</option>
                  <option value="midibus">{t("tourFormDefaults_transport_midibus")}</option>
                  <option value="private_car">{t("tourFormDefaults_transport_private_car")}</option>
                </Select>
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_fuelShare")} description={t("tourFormDefaults_logistics_fuelShare_hint")}>
            <Controller
              control={control}
              name="logistics.fuelShareToman"
              render={({ field }) => (
                <PersianNumberInput
                  numericMode="integer"
                  formatThousands
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder={t("tourFormDefaults_logistics_fuelShare_placeholder")}
                />
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_leaderInsurance")} description={t("tourFormDefaults_logistics_leaderInsurance_hint")}>
            <Controller
              control={control}
              name="logistics.leaderProvidesInsurance"
              render={({ field }) => (
                <Checkbox label={t("tourFormDefaults_logistics_leaderInsuranceCheckbox")} checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
              )}
            />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_leaderInsuranceNotes")} description={t("tourFormDefaults_logistics_leaderInsuranceNotes_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_logistics_leaderInsuranceNotes_placeholder")} {...register("logistics.leaderInsuranceNotes")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_included")} description={t("tourFormDefaults_logistics_included_hint")}>
            <Textarea rows={3} placeholder={t("tourFormDefaults_logistics_included_placeholder")} {...register("logistics.includedServices")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_excluded")} description={t("tourFormDefaults_logistics_excluded_hint")}>
            <Textarea rows={3} placeholder={t("tourFormDefaults_logistics_excluded_placeholder")} {...register("logistics.excludedServices")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_meetingDetails")} description={t("tourFormDefaults_logistics_meetingDetails_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_logistics_meetingDetails_placeholder")} {...register("logistics.meetingPointDetails")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_transportDetails")} description={t("tourFormDefaults_logistics_transportDetails_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_logistics_transportDetails_placeholder")} {...register("logistics.transportationDetails")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_transportNotes")} description={t("tourFormDefaults_logistics_transportNotes_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_logistics_transportNotes_placeholder")} {...register("logistics.transportationNotes")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_accommodationDetails")} description={t("tourFormDefaults_logistics_accommodationDetails_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_logistics_accommodationDetails_placeholder")} {...register("logistics.accommodationDetails")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_accommodationNotes")} description={t("tourFormDefaults_logistics_accommodationNotes_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_logistics_accommodationNotes_placeholder")} {...register("logistics.accommodationNotes")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_mealPlan")} description={t("tourFormDefaults_logistics_mealPlan_hint")}>
            <Input type="text" placeholder={t("tourFormDefaults_logistics_mealPlan_placeholder")} {...register("logistics.mealPlan")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_mealNotes")} description={t("tourFormDefaults_logistics_mealNotes_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_logistics_mealNotes_placeholder")} {...register("logistics.mealNotes")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_support")} description={t("tourFormDefaults_logistics_support_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_logistics_support_placeholder")} {...register("logistics.supportServicesLines")} />
          </FormField>
          <FormField label={t("tourFormDefaults_logistics_optional")} description={t("tourFormDefaults_logistics_optional_hint")}>
            <Textarea rows={2} placeholder={t("tourFormDefaults_logistics_optional_placeholder")} {...register("logistics.optionalServicesLines")} />
          </FormField>
        </div>
      </details>

      <div className={formStyles.actions}>
        <Button type="submit" variant="primary" loading={isPending} disabled={isPending}>
          {editing ? t("tourFormDefaultsSaveEdit") : t("tourFormDefaultsSaveCreate")}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={onCancel}>
          {t("tourPresetsCancel")}
        </Button>
      </div>
    </form>
  );
}
