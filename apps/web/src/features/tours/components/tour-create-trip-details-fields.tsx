"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
  useFieldArray,
} from "react-hook-form";

import { Button, FormField, Input, Select, Textarea } from "@tour/ui";

import {
  getTripDetailsFieldConfigForKind,
  type FieldRequiredness,
  type TripDetailsFieldId,
  normalizeFieldUserRole,
  resolveFieldAccess,
  type UserRole,
} from "../config/tripDetailsFieldConfig";
import {
  DIFFICULTY_LEVELS,
  EXPERIENCE_LEVELS,
  GENDER_RESTRICTIONS,
  TRIP_STYLES,
} from "../models/tourTripDetails.schema";
import type { EventKind } from "../policies/tour-kind-policy";

const detailsShell: CSSProperties = {
  border: "1px solid var(--color-neutral-200, #e5e5e5)",
  borderRadius: "8px",
  padding: "0.5rem 0.75rem",
  background: "var(--color-neutral-25, #fafafa)",
};

const summaryStyle: CSSProperties = {
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.95rem",
  listStyle: "none",
  padding: "0.25rem 0",
};

const sectionBodyStyle: CSSProperties = {
  marginTop: "0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  paddingTop: "0.25rem",
};

const chipListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.35rem",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.15rem 0.55rem",
  borderRadius: "999px",
  background: "var(--color-neutral-100, #f0f0f0)",
  fontSize: "0.8125rem",
};

const mutedHelp: CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-neutral-600, #525252)",
  margin: 0,
};

const subsectionTitleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  fontWeight: 700,
  fontSize: "0.9rem",
  color: "var(--color-neutral-900, #171717)",
};

function tripStyleLabel(v: string): string {
  const map: Record<string, string> = {
    mountaineering: "Mountaineering",
    nature: "Nature",
    cultural: "Cultural",
    city: "City",
    desert: "Desert",
    adventure: "Adventure",
    mixed: "Mixed",
  };
  return map[v] ?? v;
}

function difficultyLabel(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function genderLabel(v: string): string {
  if (v === "male_only") return "Male only";
  if (v === "female_only") return "Female only";
  return "No restriction";
}

function experienceLabel(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** RHF bridge: callers cast from their concrete form types (see `TourForm` / `TourCreateClient`). */
export type TripDetailsNestedFormProps = {
  register: UseFormRegister<FieldValues>;
  control: Control<FieldValues>;
  errors: FieldErrors<FieldValues>;
  isPending: boolean;
  isMountainTour?: boolean;
  eventKind?: EventKind;
  viewerRole?: UserRole;
};

function OptionalEnumSelect({
  control,
  name,
  label,
  description,
  error,
  disabled,
  options,
  formatLabel,
}: {
  control: Control<FieldValues>;
  name: string;
  label: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  options: readonly string[];
  formatLabel: (v: string) => string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormField label={label} description={description} error={error}>
          <Select
            invalid={Boolean(error)}
            disabled={disabled}
            value={field.value ?? ""}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            onChange={(e) => {
              const v = e.target.value;
              field.onChange(v === "" ? undefined : v);
            }}
          >
            <option value="">Select…</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {formatLabel(opt)}
              </option>
            ))}
          </Select>
        </FormField>
      )}
    />
  );
}

function StringTagListField({
  control,
  name,
  label,
  description,
  placeholder,
  error,
  disabled,
}: {
  control: Control<FieldValues>;
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const list = Array.isArray(field.value) ? (field.value as string[]) : [];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{label}</span>
            {description ? <p style={mutedHelp}>{description}</p> : null}
            {list.length > 0 ? (
              <ul style={chipListStyle}>
                {list.map((tag, i) => (
                  <li key={`${tag}-${i}`} style={chipStyle}>
                    <span>{tag}</span>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Remove ${tag}`}
                      onClick={() => field.onChange(list.filter((_, idx) => idx !== i))}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: disabled ? "not-allowed" : "pointer",
                        padding: 0,
                        lineHeight: 1,
                        fontSize: "1rem",
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <Input
                autoComplete="off"
                disabled={disabled}
                placeholder={placeholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const t = draft.trim();
                    if (t) {
                      field.onChange([...list, t]);
                      setDraft("");
                    }
                  }
                }}
                style={{ flex: 1, minWidth: "12rem" }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  const t = draft.trim();
                  if (t) {
                    field.onChange([...list, t]);
                    setDraft("");
                  }
                }}
              >
                Add
              </Button>
            </div>
            {error ? (
              <p style={{ color: "var(--color-danger-600, #b91c1c)", fontSize: "0.875rem" }} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}

function CollapsibleSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details style={detailsShell} open={Boolean(defaultOpen)}>
      <summary style={summaryStyle}>{title}</summary>
      <div style={sectionBodyStyle}>{children}</div>
    </details>
  );
}

/**
 * Grouped structured `tripDetails` fields (shared by create-tour and edit `TourForm`).
 * Uses native `<details>` for lightweight collapse (no accordion in `@tour/ui` yet).
 */
export function TourCreateTripDetailsFields({
  register,
  control,
  errors,
  isPending,
  isMountainTour = false,
  eventKind = isMountainTour ? "mountain" : "generic",
  viewerRole = normalizeFieldUserRole(undefined),
}: TripDetailsNestedFormProps) {
  const td = errors.tripDetails as Record<string, any> | undefined;
  const { fields: dayFields, append: appendDay, remove: removeDay } = useFieldArray({
    control,
    name: "tripDetails.itinerary.dayPlans",
  });
  const fieldConfig = getTripDetailsFieldConfigForKind(eventKind);
  const fieldConfigById = new Map(fieldConfig.map((row) => [row.id, row]));
  const cfg = (id: TripDetailsFieldId): { visibility: "hidden" | "readonly" | "editable"; requiredness: FieldRequiredness } => {
    const row = fieldConfigById.get(id as never);
    const resolved = resolveFieldAccess(row, viewerRole);
    return { visibility: resolved.visibility, requiredness: resolved.requiredness };
  };
  const FIELD_REQUIRED_HINT = "پر کردن این فیلد برای این نوع برنامه الزامی است.";
  const FIELD_RECOMMENDED_HINT = "توصیه می‌شود برای شفافیت بیشتر این فیلد کامل شود.";
  const labelWithRequiredness = (label: string, id: TripDetailsFieldId): string =>
    cfg(id).requiredness === "required" ? `${label} *` : label;
  const mergeDescription = (base: string | undefined, id: TripDetailsFieldId): string | undefined => {
    const r = cfg(id).requiredness;
    const hint =
      r === "required" ? FIELD_REQUIRED_HINT : r === "recommended" ? FIELD_RECOMMENDED_HINT : undefined;
    if (!base) return hint;
    if (!hint) return base;
    return `${base} ${hint}`;
  };
  const isHidden = (id: TripDetailsFieldId): boolean => cfg(id).visibility === "hidden";
  const isReadonly = (id: TripDetailsFieldId): boolean => cfg(id).visibility === "readonly";
  const isDisabled = (id: TripDetailsFieldId): boolean => isPending || isReadonly(id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <p style={{ ...mutedHelp, margin: "0 0 0.25rem" }}>
        Optional structured details are saved separately from the marketing description above and appear in API{" "}
        <code style={{ fontSize: "0.8em" }}>details.tripDetails</code>.
      </p>

      <CollapsibleSection title="1. Trip overview" defaultOpen>
        <FormField label="Schema version (optional)" error={td?.schemaVersion?.message as string | undefined}>
          <Input
            type="number"
            min={1}
            max={99}
            step={1}
            placeholder="e.g. 1"
            disabled={isPending}
            autoComplete="off"
            {...register("tripDetails.schemaVersion")}
          />
        </FormField>
        <FormField label="Main destination" error={td?.overview?.mainDestination?.message as string | undefined}>
          <Input disabled={isPending} autoComplete="off" {...register("tripDetails.overview.mainDestination")} />
        </FormField>
        <FormField label="Destination region" error={td?.overview?.destinationRegion?.message as string | undefined}>
          <Input disabled={isPending} autoComplete="off" {...register("tripDetails.overview.destinationRegion")} />
        </FormField>
        <OptionalEnumSelect
          control={control}
          name="tripDetails.overview.tripStyle"
          label="Trip style"
          error={td?.overview?.tripStyle?.message as string | undefined}
          disabled={isPending}
          options={TRIP_STYLES}
          formatLabel={tripStyleLabel}
        />
        {isHidden("overview.difficultyLevel") ? null : (
          <OptionalEnumSelect
            control={control}
            name="tripDetails.overview.difficultyLevel"
            label={labelWithRequiredness("Difficulty level", "overview.difficultyLevel")}
            description={mergeDescription(
              isMountainTour
                ? "For mountain tours this is required and should reflect both physical load and technical challenge."
                : undefined,
              "overview.difficultyLevel",
            )}
            error={td?.overview?.difficultyLevel?.message as string | undefined}
            disabled={isDisabled("overview.difficultyLevel")}
            options={DIFFICULTY_LEVELS}
            formatLabel={difficultyLabel}
          />
        )}
        <FormField
          label="Elevation gain (meters)"
          error={td?.overview?.elevationGainMeters?.message as string | undefined}
        >
          <Input
            type="number"
            min={0}
            step={1}
            disabled={isPending}
            autoComplete="off"
            {...register("tripDetails.overview.elevationGainMeters")}
          />
        </FormField>
        <FormField label="Max altitude (meters)" error={td?.overview?.maxAltitudeMeters?.message as string | undefined}>
          <Input
            type="number"
            step={1}
            disabled={isPending}
            autoComplete="off"
            {...register("tripDetails.overview.maxAltitudeMeters")}
          />
        </FormField>
        <StringTagListField
          control={control}
          name="tripDetails.overview.tourTheme"
          label="Tour themes"
          description="Keywords that describe the trip (e.g. “photography”, “family”)."
          placeholder="Add a theme and press Enter or Add"
          error={td?.overview?.tourTheme?.message as string | undefined}
          disabled={isPending}
        />
        <StringTagListField
          control={control}
          name="tripDetails.overview.bestFor"
          label="Best for"
          description="Who this tour suits best."
          placeholder="e.g. first-time hikers"
          error={td?.overview?.bestFor?.message as string | undefined}
          disabled={isPending}
        />
        <FormField label="Short intro" error={td?.overview?.shortIntro?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.overview?.shortIntro)} disabled={isPending} {...register("tripDetails.overview.shortIntro")} />
        </FormField>
      </CollapsibleSection>

      <CollapsibleSection title="2. Itinerary & highlights" defaultOpen>
        <StringTagListField
          control={control}
          name="tripDetails.itinerary.highlights"
          label="Highlights"
          placeholder="Highlight"
          error={td?.itinerary?.highlights?.message as string | undefined}
          disabled={isPending}
        />
        <StringTagListField
          control={control}
          name="tripDetails.itinerary.includedVisits"
          label="Included visits"
          placeholder="Visit or stop"
          error={td?.itinerary?.includedVisits?.message as string | undefined}
          disabled={isPending}
        />
        <StringTagListField
          control={control}
          name="tripDetails.itinerary.excludedVisits"
          label="Excluded visits"
          placeholder="Not included"
          error={td?.itinerary?.excludedVisits?.message as string | undefined}
          disabled={isPending}
        />
        <StringTagListField
          control={control}
          name="tripDetails.itinerary.optionalActivities"
          label="Optional activities"
          placeholder="Optional add-on"
          error={td?.itinerary?.optionalActivities?.message as string | undefined}
          disabled={isPending}
        />
        <StringTagListField
          control={control}
          name="tripDetails.itinerary.specialExperiences"
          label="Special experiences"
          placeholder="Unique experience"
          error={td?.itinerary?.specialExperiences?.message as string | undefined}
          disabled={isPending}
        />
        <FormField label="Itinerary outline" error={td?.itinerary?.outline?.message as string | undefined}>
          <Textarea rows={4} invalid={Boolean(td?.itinerary?.outline)} disabled={isPending} {...register("tripDetails.itinerary.outline")} />
        </FormField>
        <FormField label="Program notes" error={td?.itinerary?.programNotes?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.itinerary?.programNotes)} disabled={isPending} {...register("tripDetails.itinerary.programNotes")} />
        </FormField>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Day-by-day plan</span>
          <p style={mutedHelp}>Optional structured days (day number required per row).</p>
          {dayFields.map((row, index) => (
            <div
              key={row.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                border: "1px solid var(--color-neutral-200, #e5e5e5)",
                borderRadius: "6px",
                padding: "0.5rem",
              }}
            >
              <FormField label="Day" error={td?.itinerary?.dayPlans?.[index]?.day?.message as string | undefined}>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  disabled={isPending}
                  {...register(`tripDetails.itinerary.dayPlans.${index}.day`)}
                />
              </FormField>
              <FormField label="Title" error={td?.itinerary?.dayPlans?.[index]?.title?.message as string | undefined}>
                <Input disabled={isPending} {...register(`tripDetails.itinerary.dayPlans.${index}.title`)} />
              </FormField>
              <FormField
                label="Distance (km)"
                error={td?.itinerary?.dayPlans?.[index]?.distanceKm?.message as string | undefined}
              >
                <Input
                  type="number"
                  min={0}
                  step={1}
                  disabled={isPending}
                  {...register(`tripDetails.itinerary.dayPlans.${index}.distanceKm`)}
                />
              </FormField>
              <FormField
                label="Description"
                error={td?.itinerary?.dayPlans?.[index]?.description?.message as string | undefined}
              >
                <Textarea
                  rows={2}
                  invalid={Boolean(td?.itinerary?.dayPlans?.[index]?.description)}
                  disabled={isPending}
                  {...register(`tripDetails.itinerary.dayPlans.${index}.description`)}
                />
              </FormField>
              <FormField
                label="Elevation gain (m)"
                error={td?.itinerary?.dayPlans?.[index]?.elevationGainM?.message as string | undefined}
              >
                <Input
                  type="number"
                  step={1}
                  disabled={isPending}
                  {...register(`tripDetails.itinerary.dayPlans.${index}.elevationGainM`)}
                />
              </FormField>
              <Button type="button" variant="ghost" disabled={isPending} onClick={() => removeDay(index)}>
                Remove day
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              appendDay({
                day: dayFields.length + 1,
                title: undefined,
                description: undefined,
                distanceKm: undefined,
                elevationGainM: undefined,
              })
            }
            style={{ alignSelf: "flex-start" }}
          >
            Add day
          </Button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="3. Participation & eligibility">
        {isMountainTour ? (
          <p style={mutedHelp}>
            For mountain tours, minimum age and at least one required gear item are mandatory.
          </p>
        ) : null}
        <h4 style={subsectionTitleStyle}>سطح برنامه و تجربه</h4>
        <OptionalEnumSelect
          control={control}
          name="tripDetails.participation.fitnessLevel"
          label="سختی کلی برنامه"
          description="شدت کلی برنامه (جسمی + فنی) را مشخص کنید؛ مثلاً پیاده‌روی سبک، پیمایش سنگین یا برنامه فنی."
          error={td?.participation?.fitnessLevel?.message as string | undefined}
          disabled={isPending}
          options={DIFFICULTY_LEVELS}
          formatLabel={difficultyLabel}
        />
        {isHidden("participation.experienceLevel") ? null : (
          <OptionalEnumSelect
            control={control}
            name="tripDetails.participation.experienceLevel"
            label={labelWithRequiredness("سطح تجربه موردنیاز", "participation.experienceLevel")}
            description={mergeDescription(
              "تجربه قبلی شرکت‌کننده؛ مثل «اولین برنامه»، «سابقه پیمایش یک‌روزه»، یا «آشنا با ارتفاع بالای ۳۰۰۰ متر».",
              "participation.experienceLevel",
            )}
            error={td?.participation?.experienceLevel?.message as string | undefined}
            disabled={isDisabled("participation.experienceLevel")}
            options={EXPERIENCE_LEVELS}
            formatLabel={experienceLabel}
          />
        )}
        {isHidden("participation.technicalSkillRequired") ? null : (
          <FormField
            label={labelWithRequiredness("مهارت فنی موردنیاز", "participation.technicalSkillRequired")}
            description={mergeDescription(
              "مهارت‌های فنی خاص موردنیاز را بنویسید؛ مانند کار با کرامپون، طناب، دست‌به‌سنگ یا عبور از مسیرهای فنی.",
              "participation.technicalSkillRequired",
            )}
            error={td?.participation?.technicalSkillRequired?.message as string | undefined}
          >
            <Textarea
              rows={2}
              invalid={Boolean(td?.participation?.technicalSkillRequired)}
              disabled={isDisabled("participation.technicalSkillRequired")}
              {...register("tripDetails.participation.technicalSkillRequired")}
            />
          </FormField>
        )}

        <h4 style={subsectionTitleStyle}>سن و شرایط پزشکی</h4>
        {isHidden("participation.minimumAge") ? null : (
          <FormField
            label={labelWithRequiredness("حداقل سن مجاز", "participation.minimumAge")}
            description={mergeDescription(
              "به‌عنوان قانون پذیرش اجرا می‌شود؛ شرکت‌کنندگان کم‌سن‌تر قابل تایید نخواهند بود.",
              "participation.minimumAge",
            )}
            error={td?.participation?.minimumAge?.message as string | undefined}
          >
            <Input
              type="number"
              min={0}
              max={150}
              step={1}
              disabled={isDisabled("participation.minimumAge")}
              {...register("tripDetails.participation.minimumAge")}
            />
          </FormField>
        )}
        <FormField label="Maximum age" error={td?.participation?.maximumAge?.message as string | undefined}>
          <Input type="number" min={0} max={150} step={1} disabled={isPending} {...register("tripDetails.participation.maximumAge")} />
        </FormField>
        <OptionalEnumSelect
          control={control}
          name="tripDetails.participation.genderRestriction"
          label="Gender restriction"
          error={td?.participation?.genderRestriction?.message as string | undefined}
          disabled={isPending}
          options={GENDER_RESTRICTIONS}
          formatLabel={genderLabel}
        />
        {isHidden("participation.medicalRestrictions") ? null : (
          <FormField
            label={labelWithRequiredness("محدودیت‌های پزشکی", "participation.medicalRestrictions")}
            description={mergeDescription(
              "شرایطی را ذکر کنید که ممکن است برنامه را ناایمن کند؛ مثل بیماری قلبی، آسم کنترل‌نشده یا سابقه مشکل شدید ارتفاع.",
              "participation.medicalRestrictions",
            )}
            error={td?.participation?.medicalRestrictions?.message as string | undefined}
          >
            <Textarea
              rows={3}
              invalid={Boolean(td?.participation?.medicalRestrictions)}
              disabled={isDisabled("participation.medicalRestrictions")}
              {...register("tripDetails.participation.medicalRestrictions")}
            />
          </FormField>
        )}
        <FormField label="Requirements" error={td?.participation?.requirements?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.participation?.requirements)} disabled={isPending} {...register("tripDetails.participation.requirements")} />
        </FormField>
        <h4 style={subsectionTitleStyle}>تجهیزات</h4>
        <StringTagListField
          control={control}
          name="tripDetails.participation.skillsRequired"
          label="Skills required"
          disabled={isPending}
          placeholder="Skill"
          error={td?.participation?.skillsRequired?.message as string | undefined}
        />
        {isHidden("participation.gearRequired") ? null : (
          <StringTagListField
            control={control}
            name="tripDetails.participation.gearRequired"
            label={labelWithRequiredness("تجهیزات الزامی", "participation.gearRequired")}
            description={mergeDescription(
              "موارد مشخص و قابل تهیه بنویسید؛ مثل کفش مناسب، پوشاک لایه‌ای، هدلامپ، باتوم یا کیت کمک‌های اولیه.",
              "participation.gearRequired",
            )}
            disabled={isDisabled("participation.gearRequired")}
            placeholder="مثلاً کفش ترکینگ"
            error={td?.participation?.gearRequired?.message as string | undefined}
          />
        )}
        {isHidden("participation.gearOptional") ? null : (
          <StringTagListField
            control={control}
            name="tripDetails.participation.gearOptional"
            label={labelWithRequiredness("تجهیزات پیشنهادی", "participation.gearOptional")}
            description={mergeDescription(
              "ابزارهای مفید اما غیرالزامی؛ مثل گتر، عینک یدک، پاوربانک یا باتوم اضافه.",
              "participation.gearOptional",
            )}
            disabled={isDisabled("participation.gearOptional")}
            placeholder="مثلاً باتری اضافه هدلامپ"
            error={td?.participation?.gearOptional?.message as string | undefined}
          />
        )}
        <StringTagListField
          control={control}
          name="tripDetails.participation.documentsRequired"
          label="Documents required"
          disabled={isPending}
          placeholder="Document"
          error={td?.participation?.documentsRequired?.message as string | undefined}
        />
        <StringTagListField
          control={control}
          name="tripDetails.participation.suitableFor"
          label="Suitable for"
          disabled={isPending}
          placeholder="Audience"
          error={td?.participation?.suitableFor?.message as string | undefined}
        />
        <StringTagListField
          control={control}
          name="tripDetails.participation.notSuitableFor"
          label="Not suitable for"
          disabled={isPending}
          placeholder="Audience"
          error={td?.participation?.notSuitableFor?.message as string | undefined}
        />
      </CollapsibleSection>

      <CollapsibleSection title="4. Logistics & services">
        {isHidden("logistics.meetingPoint") ? null : (
          <FormField
            label={labelWithRequiredness("Meeting point", "logistics.meetingPoint")}
            description={mergeDescription(undefined, "logistics.meetingPoint")}
            error={td?.logistics?.meetingPoint?.message as string | undefined}
          >
            <Input disabled={isDisabled("logistics.meetingPoint")} autoComplete="off" {...register("tripDetails.logistics.meetingPoint")} />
          </FormField>
        )}
        <FormField
          label="ساعت تجمع برای حرکت"
          error={td?.logistics?.departureMeetingTime?.message as string | undefined}
        >
          <Input
            type="time"
            disabled={isPending}
            autoComplete="off"
            {...register("tripDetails.logistics.departureMeetingTime")}
          />
        </FormField>
        {isHidden("logistics.departureDate") ? null : (
          <FormField
            label={labelWithRequiredness("تاریخ رفت", "logistics.departureDate")}
            description={mergeDescription(undefined, "logistics.departureDate")}
            error={td?.logistics?.departureDate?.message as string | undefined}
          >
            <Input type="date" disabled={isDisabled("logistics.departureDate")} autoComplete="off" {...register("tripDetails.logistics.departureDate")} />
          </FormField>
        )}
        {isHidden("logistics.returnDate") ? null : (
          <FormField
            label={labelWithRequiredness("تاریخ برگشت", "logistics.returnDate")}
            description={mergeDescription(undefined, "logistics.returnDate")}
            error={td?.logistics?.returnDate?.message as string | undefined}
          >
            <Input type="date" disabled={isDisabled("logistics.returnDate")} autoComplete="off" {...register("tripDetails.logistics.returnDate")} />
          </FormField>
        )}
        <FormField label="Return point" error={td?.logistics?.returnPoint?.message as string | undefined}>
          <Input disabled={isPending} autoComplete="off" {...register("tripDetails.logistics.returnPoint")} />
        </FormField>
        {isHidden("logistics.transportation") ? null : (
          <FormField
            label={labelWithRequiredness("Transportation", "logistics.transportation")}
            description={mergeDescription(undefined, "logistics.transportation")}
            error={td?.logistics?.transportation?.message as string | undefined}
          >
            <Textarea
              rows={2}
              invalid={Boolean(td?.logistics?.transportation)}
              disabled={isDisabled("logistics.transportation")}
              {...register("tripDetails.logistics.transportation")}
            />
          </FormField>
        )}
        <FormField label="Accommodation type" error={td?.logistics?.accommodationType?.message as string | undefined}>
          <Input disabled={isPending} autoComplete="off" {...register("tripDetails.logistics.accommodationType")} />
        </FormField>
        <FormField label="Meal plan" error={td?.logistics?.mealPlan?.message as string | undefined}>
          <Textarea rows={2} invalid={Boolean(td?.logistics?.mealPlan)} disabled={isPending} {...register("tripDetails.logistics.mealPlan")} />
        </FormField>
        <StringTagListField
          control={control}
          name="tripDetails.logistics.supportServices"
          label="Support services"
          disabled={isPending}
          placeholder="Service"
          error={td?.logistics?.supportServices?.message as string | undefined}
        />
        <StringTagListField
          control={control}
          name="tripDetails.logistics.includedServices"
          label="Included services"
          disabled={isPending}
          placeholder="Service"
          error={td?.logistics?.includedServices?.message as string | undefined}
        />
        <StringTagListField
          control={control}
          name="tripDetails.logistics.excludedServices"
          label="Excluded services"
          disabled={isPending}
          placeholder="Service"
          error={td?.logistics?.excludedServices?.message as string | undefined}
        />
        <StringTagListField
          control={control}
          name="tripDetails.logistics.optionalServices"
          label="Optional services"
          disabled={isPending}
          placeholder="Service"
          error={td?.logistics?.optionalServices?.message as string | undefined}
        />
        <StringTagListField
          control={control}
          name="tripDetails.logistics.guideLanguage"
          label="Guide languages"
          disabled={isPending}
          placeholder="e.g. English"
          error={td?.logistics?.guideLanguage?.message as string | undefined}
        />
        {isHidden("logistics.groupSizeMin") ? null : (
          <FormField
            label={labelWithRequiredness("Group size (min)", "logistics.groupSizeMin")}
            description={mergeDescription(undefined, "logistics.groupSizeMin")}
            error={td?.logistics?.groupSizeMin?.message as string | undefined}
          >
            <Input type="number" min={0} step={1} disabled={isDisabled("logistics.groupSizeMin")} {...register("tripDetails.logistics.groupSizeMin")} />
          </FormField>
        )}
        {isHidden("logistics.groupSizeMax") ? null : (
          <FormField
            label={labelWithRequiredness("Group size (max)", "logistics.groupSizeMax")}
            description={mergeDescription(undefined, "logistics.groupSizeMax")}
            error={td?.logistics?.groupSizeMax?.message as string | undefined}
          >
            <Input type="number" min={0} step={1} disabled={isDisabled("logistics.groupSizeMax")} {...register("tripDetails.logistics.groupSizeMax")} />
          </FormField>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="5. Booking & attendance policies">
        <FormField label="Reservation rules" error={td?.policies?.reservationRules?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.reservationRules)} disabled={isPending} {...register("tripDetails.policies.reservationRules")} />
        </FormField>
        <FormField label="Cancellation policy" error={td?.policies?.cancellationPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.cancellationPolicy)} disabled={isPending} {...register("tripDetails.policies.cancellationPolicy")} />
        </FormField>
        <FormField label="Refund policy" error={td?.policies?.refundPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.refundPolicy)} disabled={isPending} {...register("tripDetails.policies.refundPolicy")} />
        </FormField>
        <FormField label="Attendance rules" error={td?.policies?.attendanceRules?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.attendanceRules)} disabled={isPending} {...register("tripDetails.policies.attendanceRules")} />
        </FormField>
        <FormField label="Late arrival policy" error={td?.policies?.lateArrivalPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.lateArrivalPolicy)} disabled={isPending} {...register("tripDetails.policies.lateArrivalPolicy")} />
        </FormField>
        <FormField label="No-show policy" error={td?.policies?.noShowPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.noShowPolicy)} disabled={isPending} {...register("tripDetails.policies.noShowPolicy")} />
        </FormField>
        <FormField label="Confirmation policy" error={td?.policies?.confirmationPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.confirmationPolicy)} disabled={isPending} {...register("tripDetails.policies.confirmationPolicy")} />
        </FormField>
        <FormField label="Capacity policy" error={td?.policies?.capacityPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.capacityPolicy)} disabled={isPending} {...register("tripDetails.policies.capacityPolicy")} />
        </FormField>
        <FormField label="Weather policy" error={td?.policies?.weatherPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.weatherPolicy)} disabled={isPending} {...register("tripDetails.policies.weatherPolicy")} />
        </FormField>
        <FormField label="Safety policy" error={td?.policies?.safetyPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.safetyPolicy)} disabled={isPending} {...register("tripDetails.policies.safetyPolicy")} />
        </FormField>
      </CollapsibleSection>
    </div>
  );
}
