"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, Fragment, type CSSProperties, type ReactNode } from "react";
import {
  Controller,
  type Control,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
  useFieldArray,
  useWatch,
} from "react-hook-form";

import { Button, Checkbox, FormField, Input, JalaliDatePicker, Select, Textarea } from "@tour/ui";

import {
  type FieldRequiredness,
  type TripDetailsFieldId,
  normalizeFieldUserRole,
  resolveFieldAccess,
  type UserRole,
} from "../config/tripDetailsFieldConfig";
import { getTripDetailsFieldConfigForProfile } from "../config/tripDetailsFieldConfigAdapter";
import type { TourFormProfile } from "@repo/types";
import { ACCOMMODATION_TYPE_VALUES, MEAL_PLAN_VALUES } from "@repo/types";
import {
  DIFFICULTY_LEVELS,
  EXPERIENCE_LEVELS,
  GENDER_RESTRICTIONS,
  TRIP_STYLES,
} from "../models/tourTripDetails.schema";
import { useSettingsEquipment } from "@/hooks/use-settings-equipment";
import { useSettingsGuideLanguages } from "@/hooks/use-settings-guide-languages";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { DenaliGatheringPointsWidget } from "@/features/tours/wizard/denali/components/DenaliGatheringPointsWidget";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { uiLocaleDigits, convertNumbers } from "../../../lib/number-utils";
import { computeTourDurationDays } from "../domain/computeTourDurationDays";
import {
  DIFFICULTY_RATING_VALUES,
  formatDifficultyRating,
} from "../domain/difficulty-rating";
import { AUDIENCE_GROUP_VALUES, type AudienceGroup } from "../domain/audience-groups";
import {
  TRIP_SHORT_INTRO_MAX_LENGTH,
} from "../models/tourTripDetails.schema";

const detailsShell: CSSProperties = {
  border: "1px solid var(--color-neutral-200, #e5e5e5)",
  borderRadius: "8px",
  padding: "0.5rem 0.75rem",
  background: "var(--color-neutral-25, #fafafa)",
};

const AUDIENCE_LABEL_KEYS: Record<AudienceGroup, string> = {
  families: "trip_audienceGroup_families",
  solo_travelers: "trip_audienceGroup_solo_travelers",
  seniors: "trip_audienceGroup_seniors",
  kids: "trip_audienceGroup_kids",
  beginners: "trip_audienceGroup_beginners",
  experienced_hikers: "trip_audienceGroup_experienced_hikers",
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

/** Local-time Gregorian YMD (avoids timezone drift from `toISOString`). */
function toGregorianYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tripStylesOptionLabel(v: string, t: (key: string) => string): string {
  const keys: Record<string, string> = {
    adventure: "trip_styleAdventure",
    relaxed: "trip_styleRelaxed",
    luxury: "trip_styleLuxury",
    budget: "trip_styleBudget",
    familyFriendly: "trip_styleFamilyFriendly",
    photography: "trip_stylePhotography",
  };
  const k = keys[v];
  return k ? t(k) : v;
}

function difficultyLabel(v: string, t: (key: string) => string): string {
  return t(`trip_difficulty${v.charAt(0).toUpperCase()}${v.slice(1)}`);
}

function genderLabel(v: string, t: (key: string) => string): string {
  if (v === "male_only") return t("trip_genderMaleOnly");
  if (v === "female_only") return t("trip_genderFemaleOnly");
  return t("trip_genderNone");
}

function experienceLabel(v: string, t: (key: string) => string): string {
  return t(`trip_experience${v.charAt(0).toUpperCase()}${v.slice(1)}`);
}

/**
 * RHF bridge: only caller after Phase C cleanup is the flat Edit form
 * (`apps/web/src/components/tours/TourForm.tsx`). The dead `TourCreateClient`
 * caller was removed in Phase C alongside the rest of the legacy single-page
 * create surface.
 */
export type TripDetailsNestedFormProps = {
  register: UseFormRegister<FieldValues>;
  control: Control<FieldValues>;
  errors: FieldErrors<FieldValues>;
  isPending: boolean;
  /** Canonical profile used for visibility/requiredness in Edit flow. */
  formProfile?: TourFormProfile;
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
  const t = useTranslations("tours.new");
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
            <option value="">{t("trip_selectEmpty")}</option>
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

function TourThemeIdsCheckboxField({
  control,
  name,
  label,
  description,
  error,
  disabled,
  themes,
  loading,
  loadFailed,
  emptyHint,
  ariaGroupLabel,
}: {
  control: Control<FieldValues>;
  name: string;
  label: string;
  description?: string;
  error?: string;
  disabled: boolean;
  themes: { id: string; name: string; isActive: boolean }[];
  loading: boolean;
  loadFailed: boolean;
  emptyHint: string;
  ariaGroupLabel: string;
}) {
  const t = useTranslations("tours.new");
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const raw = Array.isArray(field.value) ? (field.value as string[]) : [];
        const selected = new Set(raw);
        const byId = new Map(themes.map((row) => [row.id, row]));
        const activeSorted = themes.filter((row) => row.isActive);
        const catalogIds = new Set(activeSorted.map((row) => row.id));
        const inactiveSelected = themes.filter((row) => !row.isActive && selected.has(row.id));
        const orphanIds = raw.filter((id) => !byId.has(id));
        type Row = { id: string; label: string };
        const rows: Row[] = [
          ...activeSorted.map((row) => ({ id: row.id, label: row.name })),
          ...inactiveSelected.map((row) => ({
            id: row.id,
            label: `${row.name}${t("trip_tourThemeInactiveSuffix")}`,
          })),
          ...orphanIds.map((id) => ({
            id,
            label: `${t("trip_tourThemeOrphanLabel")} (${id.slice(0, 8)}…)`,
          })),
        ];
        const toggle = (id: string) => {
          const next = new Set(selected);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          const catalogOrder = activeSorted.map((row) => row.id).filter((rowId) => next.has(rowId));
          const extra = [...next].filter((rowId) => !catalogIds.has(rowId));
          field.onChange([...catalogOrder, ...extra]);
        };
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{label}</span>
            {description ? <p style={mutedHelp}>{description}</p> : null}
            {loading ? <p style={mutedHelp}>{t("trip_tourThemesLoading")}</p> : null}
            {!loading && loadFailed ? (
              <p style={{ color: "var(--color-danger-600, #b91c1c)", fontSize: "0.875rem" }} role="alert">
                {t("trip_tourThemesLoadError")}
              </p>
            ) : null}
            {!loading && !loadFailed && rows.length === 0 ? <p style={mutedHelp}>{emptyHint}</p> : null}
            {!loading && !loadFailed && rows.length > 0 ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                role="group"
                aria-label={ariaGroupLabel}
              >
                {rows.map((row) => (
                  <Checkbox
                    key={row.id}
                    label={row.label}
                    checked={selected.has(row.id)}
                    disabled={disabled}
                    onChange={() => toggle(row.id)}
                  />
                ))}
              </div>
            ) : null}
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
  const t = useTranslations("tours.new");
  const locale = useLocale();
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
                      aria-label={t("trip_tagRemoveAria", { tag })}
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
                placeholder={placeholder != null ? uiLocaleDigits(placeholder, locale) : undefined}
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
                {t("trip_tagAdd")}
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

function EquipmentIdsCheckboxField({
  control,
  name,
  label,
  description,
  error,
  disabled,
  items,
  loading,
  loadFailed,
  emptyHint,
  ariaGroupLabel,
}: {
  control: Control<FieldValues>;
  name: string;
  label: string;
  description?: string;
  error?: string;
  disabled: boolean;
  items: { id: string; name: string }[];
  loading: boolean;
  loadFailed: boolean;
  emptyHint: string;
  ariaGroupLabel: string;
}) {
  const t = useTranslations("tours.new");
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const raw = Array.isArray(field.value) ? (field.value as string[]) : [];
        const selected = new Set(raw);
        const toggle = (id: string) => {
          const next = new Set(selected);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          const ordered = items.map((row) => row.id).filter((rowId) => next.has(rowId));
          field.onChange(ordered);
        };
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{label}</span>
            {description ? <p style={mutedHelp}>{description}</p> : null}
            {loading ? <p style={mutedHelp}>{t("trip_gearEquipmentLoading")}</p> : null}
            {!loading && loadFailed ? (
              <p style={{ color: "var(--color-danger-600, #b91c1c)", fontSize: "0.875rem" }} role="alert">
                {t("trip_gearEquipmentLoadError")}
              </p>
            ) : null}
            {!loading && !loadFailed && items.length === 0 ? <p style={mutedHelp}>{emptyHint}</p> : null}
            {!loading && !loadFailed && items.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }} role="group" aria-label={ariaGroupLabel}>
                {items.map((row) => (
                  <Checkbox
                    key={row.id}
                    label={row.name}
                    checked={selected.has(row.id)}
                    disabled={disabled}
                    onChange={() => toggle(row.id)}
                  />
                ))}
              </div>
            ) : null}
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
  formProfile = "general",
  viewerRole = normalizeFieldUserRole(undefined),
}: TripDetailsNestedFormProps) {
  const t = useTranslations("tours.new");
  const locale = useLocale();
  const ph = (key: string) => uiLocaleDigits(t(key), locale);
  const td = errors.tripDetails as Record<string, any> | undefined;
  const { fields: dayFields, append: appendDay, remove: removeDay } = useFieldArray({
    control,
    name: "tripDetails.itinerary.dayPlans",
  });
  const departureYmd = useWatch({ control, name: "tripDetails.logistics.departureDate" }) as string | undefined;
  const returnYmd = useWatch({ control, name: "tripDetails.logistics.returnDate" }) as string | undefined;
  const derivedDurationDays = useMemo(
    () => computeTourDurationDays(departureYmd, returnYmd),
    [departureYmd, returnYmd],
  );
  const shortIntroWatch = useWatch({ control, name: "tripDetails.overview.shortIntro" }) as string | undefined;
  const todayYmd = useMemo(() => toGregorianYmd(new Date()), []);
  const maxBookableYmd = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return toGregorianYmd(d);
  }, []);
  const returnMinYmd = useMemo(() => {
    const dep = typeof departureYmd === "string" ? departureYmd.trim() : "";
    return dep && dep > todayYmd ? dep : todayYmd;
  }, [departureYmd, todayYmd]);
  const fieldConfig = getTripDetailsFieldConfigForProfile(formProfile);
  const isMountainProfile = formProfile === "mountain_outdoor";
  const fieldConfigById = new Map(fieldConfig.map((row) => [row.id, row]));
  const cfg = (id: TripDetailsFieldId): { visibility: "hidden" | "readonly" | "editable"; requiredness: FieldRequiredness } => {
    const row = fieldConfigById.get(id as never);
    const resolved = resolveFieldAccess(row, viewerRole);
    return { visibility: resolved.visibility, requiredness: resolved.requiredness };
  };
  const FIELD_REQUIRED_HINT = t("trip_fieldRequiredHint");
  const FIELD_RECOMMENDED_HINT = t("trip_fieldRecommendedHint");
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

  const equipmentQuery = useSettingsEquipment();
  const equipmentItems = useMemo(
    () => (equipmentQuery.data ?? []).map((row) => ({ id: row.id, name: row.name })),
    [equipmentQuery.data],
  );
  const guideLanguagesQuery = useSettingsGuideLanguages();
  const guideLanguageItems = useMemo(
    () => (guideLanguagesQuery.data ?? []).map((row) => ({ id: row.id, name: row.name })),
    [guideLanguagesQuery.data],
  );
  const tourThemesQuery = useSettingsTourThemes();
  const tourThemeRows = useMemo(
    () =>
      (tourThemesQuery.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        isActive: row.isActive,
      })),
    [tourThemesQuery.data],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <p style={{ ...mutedHelp, margin: "0 0 0.25rem" }}>
        {t("trip_introHelp", { code: t("trip_introHelpCode") })}
      </p>

      <CollapsibleSection title={t("trip_sectionOverview")} defaultOpen>
        <FormField label={t("trip_mainDestinationLabel")} error={td?.overview?.mainDestination?.message as string | undefined}>
          <Input disabled={isPending} autoComplete="off" {...register("tripDetails.overview.mainDestination")} />
        </FormField>
        <FormField label={t("trip_destinationRegionLabel")} error={td?.overview?.destinationRegion?.message as string | undefined}>
          <Input disabled={isPending} autoComplete="off" {...register("tripDetails.overview.destinationRegion")} />
        </FormField>
        {isHidden("overview.tripStyles") ? null : (
          <FormField
            label={t("trip_tripStyleLabel")}
            description={t("trip_tripStyleDescription")}
            error={td?.overview?.tripStyles?.message as string | undefined}
          >
            <Controller
              control={control}
              name="tripDetails.overview.tripStyles"
              render={({ field }) => {
                const value = Array.isArray(field.value) ? (field.value as string[]) : [];
                return (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                    role="group"
                    aria-label={t("trip_tripStyleLabel")}
                  >
                    {TRIP_STYLES.map((style) => (
                      <Checkbox
                        key={style}
                        label={tripStylesOptionLabel(style, t)}
                        checked={value.includes(style)}
                        disabled={isPending}
                        onChange={(e) => {
                          const next = new Set(value);
                          if (e.target.checked) {
                            next.add(style);
                          } else {
                            next.delete(style);
                          }
                          field.onChange([...next]);
                        }}
                      />
                    ))}
                  </div>
                );
              }}
            />
          </FormField>
        )}
        {isHidden("overview.difficultyLevel") ? null : (
          <Controller
            control={control}
            name="tripDetails.overview.difficultyLevel"
            render={({ field }) => {
              const current =
                typeof field.value === "number"
                  ? field.value
                  : typeof field.value === "string" && field.value !== ""
                    ? Number(convertNumbers(field.value, "en"))
                    : NaN;
              const selectValue = Number.isFinite(current) ? String(current) : "";
              return (
                <FormField
                  label={labelWithRequiredness(
                    t("trip_difficultyLevelLabel"),
                    "overview.difficultyLevel",
                  )}
                  description={mergeDescription(
                    isMountainProfile
                      ? `${t("trip_difficultyLevelDescription")} ${t("trip_difficultyMountainDescription")}`
                      : t("trip_difficultyLevelDescription"),
                    "overview.difficultyLevel",
                  )}
                  error={td?.overview?.difficultyLevel?.message as string | undefined}
                >
                  <Select
                    invalid={Boolean(td?.overview?.difficultyLevel)}
                    disabled={isDisabled("overview.difficultyLevel")}
                    value={selectValue}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        field.onChange(undefined);
                        return;
                      }
                      const n = Number(raw);
                      field.onChange(Number.isFinite(n) ? n : undefined);
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  >
                    <option value="">{t("selectPlaceholder")}</option>
                    {DIFFICULTY_RATING_VALUES.map((v) => {
                      const rendered = formatDifficultyRating(v);
                      return (
                        <option key={rendered} value={rendered}>
                          {locale === "fa" ? convertNumbers(rendered, "fa") : rendered}
                        </option>
                      );
                    })}
                  </Select>
                </FormField>
              );
            }}
          />
        )}
        <FormField
          label={t("trip_elevationGainMetersLabel")}
          error={td?.overview?.elevationGainMeters?.message as string | undefined}
        >
          <Controller
            control={control}
            name="tripDetails.overview.elevationGainMeters"
            render={({ field }) => (
              <PersianNumberInput
                autoComplete="off"
                disabled={isPending}
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
        {isHidden("overview.maxAltitudeMeters") ? null : (
          <FormField
            label={labelWithRequiredness(
              t("trip_maxAltitudeMetersLabel"),
              "overview.maxAltitudeMeters",
            )}
            description={mergeDescription(
              t("trip_maxAltitudeMetersDescription"),
              "overview.maxAltitudeMeters",
            )}
            error={td?.overview?.maxAltitudeMeters?.message as string | undefined}
          >
            <Controller
              control={control}
              name="tripDetails.overview.maxAltitudeMeters"
              render={({ field }) => (
                <PersianNumberInput
                  autoComplete="off"
                  disabled={isDisabled("overview.maxAltitudeMeters")}
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
        )}
        {isHidden("overview.tourThemeIds") ? null : (
          <TourThemeIdsCheckboxField
            control={control}
            name="tripDetails.overview.tourThemeIds"
            label={t("trip_tourThemesLabel")}
            description={mergeDescription(t("trip_tourThemesDescription"), "overview.tourThemeIds")}
            error={td?.overview?.tourThemeIds?.message as string | undefined}
            disabled={isPending}
            themes={tourThemeRows}
            loading={tourThemesQuery.isLoading}
            loadFailed={tourThemesQuery.isError}
            emptyHint={t("trip_tourThemesEmptyHint")}
            ariaGroupLabel={t("trip_tourThemesLabel")}
          />
        )}
        <FormField
          label={t("trip_shortIntroLabel")}
          description={
            <>
              <span>{mergeDescription(t("trip_shortIntroDescription"), "overview.shortIntro")}</span>
              <span style={{ display: "block", marginTop: "0.35rem", fontSize: "0.8125rem", opacity: 0.85 }}>
                {uiLocaleDigits(
                  t("trip_shortIntroCharCounter", {
                    current: (shortIntroWatch ?? "").length,
                    max: TRIP_SHORT_INTRO_MAX_LENGTH,
                  }),
                  locale,
                )}
              </span>
            </>
          }
          error={td?.overview?.shortIntro?.message as string | undefined}
        >
          <Textarea
            rows={3}
            maxLength={TRIP_SHORT_INTRO_MAX_LENGTH}
            invalid={Boolean(td?.overview?.shortIntro)}
            disabled={isPending}
            {...register("tripDetails.overview.shortIntro")}
          />
        </FormField>
      </CollapsibleSection>

      <CollapsibleSection title={t("trip_sectionItinerary")} defaultOpen>
        <StringTagListField
          control={control}
          name="tripDetails.itinerary.highlights"
          label={t("trip_highlightsLabel")}
          placeholder={ph("trip_highlightsPlaceholder")}
          error={td?.itinerary?.highlights?.message as string | undefined}
          disabled={isPending}
        />
        <StringTagListField
          control={control}
          name="tripDetails.itinerary.includedVisits"
          label={t("trip_includedVisitsLabel")}
          placeholder={ph("trip_includedVisitsPlaceholder")}
          error={td?.itinerary?.includedVisits?.message as string | undefined}
          disabled={isPending}
        />
        <StringTagListField
          control={control}
          name="tripDetails.itinerary.excludedVisits"
          label={t("trip_excludedVisitsLabel")}
          placeholder={ph("trip_excludedVisitsPlaceholder")}
          error={td?.itinerary?.excludedVisits?.message as string | undefined}
          disabled={isPending}
        />
        <StringTagListField
          control={control}
          name="tripDetails.itinerary.optionalActivities"
          label={t("trip_optionalActivitiesLabel")}
          placeholder={ph("trip_optionalActivitiesPlaceholder")}
          error={td?.itinerary?.optionalActivities?.message as string | undefined}
          disabled={isPending}
        />
        <StringTagListField
          control={control}
          name="tripDetails.itinerary.specialExperiences"
          label={t("trip_specialExperiencesLabel")}
          placeholder={ph("trip_specialExperiencesPlaceholder")}
          error={td?.itinerary?.specialExperiences?.message as string | undefined}
          disabled={isPending}
        />
        <FormField label={t("trip_itineraryOutlineLabel")} error={td?.itinerary?.outline?.message as string | undefined}>
          <Textarea rows={4} invalid={Boolean(td?.itinerary?.outline)} disabled={isPending} {...register("tripDetails.itinerary.outline")} />
        </FormField>
        <FormField label={t("trip_programNotesLabel")} error={td?.itinerary?.programNotes?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.itinerary?.programNotes)} disabled={isPending} {...register("tripDetails.itinerary.programNotes")} />
        </FormField>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t("trip_dayByDayTitle")}</span>
          <p style={mutedHelp}>{t("trip_dayByDayHelp")}</p>
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
              <FormField label={t("trip_dayPlanDayLabel")} error={td?.itinerary?.dayPlans?.[index]?.day?.message as string | undefined}>
                <Controller
                  control={control}
                  name={`tripDetails.itinerary.dayPlans.${index}.day`}
                  render={({ field }) => (
                    <PersianNumberInput
                      disabled={isPending}
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
              <FormField label={t("trip_dayPlanTitleLabel")} error={td?.itinerary?.dayPlans?.[index]?.title?.message as string | undefined}>
                <Input disabled={isPending} {...register(`tripDetails.itinerary.dayPlans.${index}.title`)} />
              </FormField>
              <FormField
                label={t("trip_dayPlanDistanceLabel")}
                error={td?.itinerary?.dayPlans?.[index]?.distanceKm?.message as string | undefined}
              >
                <Controller
                  control={control}
                  name={`tripDetails.itinerary.dayPlans.${index}.distanceKm`}
                  render={({ field }) => (
                    <PersianNumberInput
                      disabled={isPending}
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
                label={t("trip_dayPlanDescriptionLabel")}
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
                label={t("trip_dayPlanElevationLabel")}
                error={td?.itinerary?.dayPlans?.[index]?.elevationGainM?.message as string | undefined}
              >
                <Controller
                  control={control}
                  name={`tripDetails.itinerary.dayPlans.${index}.elevationGainM`}
                  render={({ field }) => (
                    <PersianNumberInput
                      disabled={isPending}
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
              <Button type="button" variant="ghost" disabled={isPending} onClick={() => removeDay(index)}>
                {t("trip_removeDay")}
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
            {t("trip_addDay")}
          </Button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t("trip_sectionParticipation")}>
        {isMountainProfile ? (
          <p style={mutedHelp}>
            {t("trip_mountainRequiredNote")}
          </p>
        ) : null}
        <h4 style={subsectionTitleStyle}>{t("trip_subsectionProgramExperience")}</h4>
        <OptionalEnumSelect
          control={control}
          name="tripDetails.participation.fitnessLevel"
          label={t("trip_fitnessLabel")}
          description={t("trip_fitnessDescription")}
          error={td?.participation?.fitnessLevel?.message as string | undefined}
          disabled={isPending}
          options={DIFFICULTY_LEVELS}
          formatLabel={(v) => difficultyLabel(v, t)}
        />
        {isHidden("participation.experienceLevel") ? null : (
          <OptionalEnumSelect
            control={control}
            name="tripDetails.participation.experienceLevel"
            label={labelWithRequiredness(t("trip_experienceLevelLabel"), "participation.experienceLevel")}
            description={mergeDescription(t("trip_experienceLevelDescription"), "participation.experienceLevel")}
            error={td?.participation?.experienceLevel?.message as string | undefined}
            disabled={isDisabled("participation.experienceLevel")}
            options={EXPERIENCE_LEVELS}
            formatLabel={(v) => experienceLabel(v, t)}
          />
        )}
        {isHidden("participation.technicalSkillRequired") ? null : (
          <FormField
            label={labelWithRequiredness(t("trip_technicalSkillLabel"), "participation.technicalSkillRequired")}
            description={mergeDescription(t("trip_technicalSkillDescription"), "participation.technicalSkillRequired")}
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

        <h4 style={subsectionTitleStyle}>{t("trip_subsectionAgeMedical")}</h4>
        {isHidden("participation.minimumAge") ? null : (
          <FormField
            label={labelWithRequiredness(t("trip_minimumAgeLabel"), "participation.minimumAge")}
            description={mergeDescription(t("trip_minimumAgeDescription"), "participation.minimumAge")}
            error={td?.participation?.minimumAge?.message as string | undefined}
          >
            <Controller
              control={control}
              name="tripDetails.participation.minimumAge"
              render={({ field }) => (
                <PersianNumberInput
                  disabled={isDisabled("participation.minimumAge")}
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
        )}
        <FormField label={t("trip_maximumAgeLabel")} error={td?.participation?.maximumAge?.message as string | undefined}>
          <Controller
            control={control}
            name="tripDetails.participation.maximumAge"
            render={({ field }) => (
              <PersianNumberInput
                disabled={isPending}
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
        <OptionalEnumSelect
          control={control}
          name="tripDetails.participation.genderRestriction"
          label={t("trip_genderRestrictionLabel")}
          error={td?.participation?.genderRestriction?.message as string | undefined}
          disabled={isPending}
          options={GENDER_RESTRICTIONS}
          formatLabel={(v) => genderLabel(v, t)}
        />
        {isHidden("participation.medicalRestrictions") ? null : (
          <FormField
            label={labelWithRequiredness(t("trip_medicalRestrictionsLabel"), "participation.medicalRestrictions")}
            description={mergeDescription(t("trip_medicalRestrictionsDescription"), "participation.medicalRestrictions")}
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
        <FormField label={t("trip_requirementsLabel")} error={td?.participation?.requirements?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.participation?.requirements)} disabled={isPending} {...register("tripDetails.participation.requirements")} />
        </FormField>
        <h4 style={subsectionTitleStyle}>تجهیزات</h4>
        <StringTagListField
          control={control}
          name="tripDetails.participation.skillsRequired"
          label={t("trip_skillsRequiredLabel")}
          disabled={isPending}
          placeholder={ph("trip_skillsRequiredPlaceholder")}
          error={td?.participation?.skillsRequired?.message as string | undefined}
        />
        {isHidden("participation.gearRequiredIds") ? null : (
          <EquipmentIdsCheckboxField
            control={control}
            name="tripDetails.participation.gearRequiredIds"
            label={labelWithRequiredness(t("trip_gearRequiredLabel"), "participation.gearRequiredIds")}
            description={mergeDescription(t("trip_gearRequiredDescription"), "participation.gearRequiredIds")}
            disabled={isDisabled("participation.gearRequiredIds")}
            items={equipmentItems}
            loading={equipmentQuery.isLoading}
            loadFailed={equipmentQuery.isError}
            emptyHint={t("trip_gearEquipmentEmptyHint")}
            ariaGroupLabel={t("trip_gearRequiredLabel")}
            error={td?.participation?.gearRequiredIds?.message as string | undefined}
          />
        )}
        {isHidden("participation.gearOptionalIds") ? null : (
          <EquipmentIdsCheckboxField
            control={control}
            name="tripDetails.participation.gearOptionalIds"
            label={labelWithRequiredness(t("trip_gearOptionalLabel"), "participation.gearOptionalIds")}
            description={mergeDescription(t("trip_gearOptionalDescription"), "participation.gearOptionalIds")}
            disabled={isDisabled("participation.gearOptionalIds")}
            items={equipmentItems}
            loading={equipmentQuery.isLoading}
            loadFailed={equipmentQuery.isError}
            emptyHint={t("trip_gearEquipmentEmptyHint")}
            ariaGroupLabel={t("trip_gearOptionalLabel")}
            error={td?.participation?.gearOptionalIds?.message as string | undefined}
          />
        )}
        <StringTagListField
          control={control}
          name="tripDetails.participation.documentsRequired"
          label={t("trip_documentsRequiredLabel")}
          disabled={isPending}
          placeholder={ph("trip_documentsRequiredPlaceholder")}
          error={td?.participation?.documentsRequired?.message as string | undefined}
        />
        {isHidden("participation.suitableFor") && isHidden("participation.notSuitableFor") ? null : (
          <FormField
            label={labelWithRequiredness(t("trip_audienceMatrixLabel"), "participation.suitableFor")}
            description={mergeDescription(t("trip_audienceMatrixDescription"), "participation.suitableFor")}
            error={
              (td?.participation?.notSuitableFor?.message as string | undefined) ??
              (td?.participation?.suitableFor?.message as string | undefined)
            }
          >
            <Controller
              control={control}
              name="tripDetails.participation.suitableFor"
              render={({ field: suitField }) => (
                <Controller
                  control={control}
                  name="tripDetails.participation.notSuitableFor"
                  render={({ field: notField }) => {
                    const suitArr = Array.isArray(suitField.value) ? (suitField.value as AudienceGroup[]) : [];
                    const notArr = Array.isArray(notField.value) ? (notField.value as AudienceGroup[]) : [];
                    const suit = new Set(suitArr);
                    const not = new Set(notArr);
                    const disabledMatrix =
                      isDisabled("participation.suitableFor") || isDisabled("participation.notSuitableFor");
                    const setSuitable = (g: AudienceGroup, on: boolean) => {
                      const nextS = new Set(suit);
                      const nextN = new Set(not);
                      if (on) {
                        nextN.delete(g);
                        nextS.add(g);
                      } else {
                        nextS.delete(g);
                      }
                      suitField.onChange(nextS.size > 0 ? [...nextS].sort((a, b) => a.localeCompare(b)) : []);
                      notField.onChange(nextN.size > 0 ? [...nextN].sort((a, b) => a.localeCompare(b)) : []);
                    };
                    const setNotSuitable = (g: AudienceGroup, on: boolean) => {
                      const nextS = new Set(suit);
                      const nextN = new Set(not);
                      if (on) {
                        nextS.delete(g);
                        nextN.add(g);
                      } else {
                        nextN.delete(g);
                      }
                      suitField.onChange(nextS.size > 0 ? [...nextS].sort((a, b) => a.localeCompare(b)) : []);
                      notField.onChange(nextN.size > 0 ? [...nextN].sort((a, b) => a.localeCompare(b)) : []);
                    };
                    return (
                      <div
                        dir={locale === "fa" ? "rtl" : "ltr"}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.35rem",
                          fontSize: "0.875rem",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0,1fr) auto auto",
                            gap: "0.35rem 0.75rem",
                            alignItems: "center",
                          }}
                        >
                          <span />
                          <span style={{ fontWeight: 600, textAlign: "center" }}>{t("trip_audienceColumnSuitable")}</span>
                          <span style={{ fontWeight: 600, textAlign: "center" }}>{t("trip_audienceColumnNotSuitable")}</span>
                          {AUDIENCE_GROUP_VALUES.map((g) => (
                            <Fragment key={g}>
                              <span>{t(AUDIENCE_LABEL_KEYS[g] as never)}</span>
                              <div style={{ display: "flex", justifyContent: "center" }}>
                                <Checkbox
                                  bare
                                  checked={suit.has(g)}
                                  disabled={disabledMatrix}
                                  aria-label={`${t(AUDIENCE_LABEL_KEYS[g] as never)} — ${t("trip_audienceColumnSuitable")}`}
                                  onChange={(e) => {
                                    setSuitable(g, e.target.checked);
                                  }}
                                />
                              </div>
                              <div style={{ display: "flex", justifyContent: "center" }}>
                                <Checkbox
                                  bare
                                  checked={not.has(g)}
                                  disabled={disabledMatrix}
                                  aria-label={`${t(AUDIENCE_LABEL_KEYS[g] as never)} — ${t("trip_audienceColumnNotSuitable")}`}
                                  onChange={(e) => {
                                    setNotSuitable(g, e.target.checked);
                                  }}
                                />
                              </div>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
              )}
            />
          </FormField>
        )}
      </CollapsibleSection>

      <CollapsibleSection title={t("trip_sectionLogistics")}>
        <DenaliGatheringPointsWidget name="tripDetails.logistics.gatheringPoints" />
        {isHidden("logistics.departureDate") ? null : (
          <Controller
            control={control}
            name="tripDetails.logistics.departureDate"
            render={({ field }) => (
              <FormField
                label={labelWithRequiredness(t("trip_departureDateLabel"), "logistics.departureDate")}
                description={mergeDescription(undefined, "logistics.departureDate")}
                error={td?.logistics?.departureDate?.message as string | undefined}
              >
                <JalaliDatePicker
                  ref={field.ref}
                  name={field.name}
                  value={typeof field.value === "string" ? field.value : ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isDisabled("logistics.departureDate")}
                  invalid={Boolean(td?.logistics?.departureDate)}
                  minDate={todayYmd}
                  maxDate={maxBookableYmd}
                  clearLabel={t("trip_jalaliClear")}
                  openCalendarAriaLabel={t("trip_openCalendarAria")}
                />
              </FormField>
            )}
          />
        )}
        {isHidden("logistics.returnDate") ? null : (
          <Controller
            control={control}
            name="tripDetails.logistics.returnDate"
            render={({ field }) => (
              <FormField
                label={labelWithRequiredness(t("trip_returnDateLabel"), "logistics.returnDate")}
                description={mergeDescription(undefined, "logistics.returnDate")}
                error={td?.logistics?.returnDate?.message as string | undefined}
              >
                <JalaliDatePicker
                  ref={field.ref}
                  name={field.name}
                  value={typeof field.value === "string" ? field.value : ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isDisabled("logistics.returnDate")}
                  invalid={Boolean(td?.logistics?.returnDate)}
                  minDate={returnMinYmd}
                  maxDate={maxBookableYmd}
                  clearLabel={t("trip_jalaliClear")}
                  openCalendarAriaLabel={t("trip_openCalendarAria")}
                />
              </FormField>
            )}
          />
        )}
        {derivedDurationDays !== undefined ? (
          <FormField
            label={t("trip_durationDaysComputedLabel")}
            description={t("trip_durationDaysComputedDescription")}
          >
            <Input
              type="text"
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              value={
                locale === "fa"
                  ? convertNumbers(String(derivedDurationDays), "fa")
                  : String(derivedDurationDays)
              }
              dir="rtl"
            />
          </FormField>
        ) : null}
        {isHidden("logistics.transportationNotes") ? null : (
          <FormField
            label={labelWithRequiredness(t("trip_transportationNotesLabel"), "logistics.transportationNotes")}
            description={mergeDescription(undefined, "logistics.transportationNotes")}
            error={td?.logistics?.transportationNotes?.message as string | undefined}
          >
            <Textarea
              rows={2}
              invalid={Boolean(td?.logistics?.transportationNotes)}
              disabled={isDisabled("logistics.transportationNotes")}
              {...register("tripDetails.logistics.transportationNotes")}
            />
          </FormField>
        )}
        {isHidden("logistics.accommodationTypes") ? null : (
          <FormField
            label={labelWithRequiredness(t("trip_accommodationTypesLabel"), "logistics.accommodationTypes")}
            description={mergeDescription(undefined, "logistics.accommodationTypes")}
            error={td?.logistics?.accommodationTypes?.message as string | undefined}
          >
            <Controller
              name="tripDetails.logistics.accommodationTypes"
              control={control}
              render={({ field }) => (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                  role="group"
                  aria-label={t("trip_accommodationTypesLabel")}
                >
                  {ACCOMMODATION_TYPE_VALUES.map((slug) => (
                    <Checkbox
                      key={slug}
                      label={t(`trip_accommodation_${slug}`)}
                      checked={(field.value ?? ([] as string[])).includes(slug)}
                      disabled={isPending || isDisabled("logistics.accommodationTypes")}
                      onChange={(e) => {
                        const prev = (field.value ?? []) as string[];
                        const next = new Set(prev);
                        if (e.target.checked) {
                          next.add(slug);
                        } else {
                          next.delete(slug);
                        }
                        field.onChange([...next].sort((a, b) => a.localeCompare(b)));
                      }}
                    />
                  ))}
                </div>
              )}
            />
          </FormField>
        )}
        {isHidden("logistics.accommodationNotes") ? null : (
          <FormField
            label={t("trip_accommodationNotesLabel")}
            error={td?.logistics?.accommodationNotes?.message as string | undefined}
          >
            <Textarea
              rows={2}
              invalid={Boolean(td?.logistics?.accommodationNotes)}
              disabled={isPending || isDisabled("logistics.accommodationNotes")}
              {...register("tripDetails.logistics.accommodationNotes")}
            />
          </FormField>
        )}
        {isHidden("logistics.mealPlan") ? null : (
          <OptionalEnumSelect
            control={control}
            name="tripDetails.logistics.mealPlan"
            label={labelWithRequiredness(t("trip_mealPlanLabel"), "logistics.mealPlan")}
            description={mergeDescription(undefined, "logistics.mealPlan")}
            error={td?.logistics?.mealPlan?.message as string | undefined}
            disabled={isPending || isDisabled("logistics.mealPlan")}
            options={MEAL_PLAN_VALUES}
            formatLabel={(v) => t(`trip_mealPlan_${v}`)}
          />
        )}
        {isHidden("logistics.mealNotes") ? null : (
          <FormField
            label={t("trip_mealNotesLabel")}
            error={td?.logistics?.mealNotes?.message as string | undefined}
          >
            <Textarea
              rows={2}
              invalid={Boolean(td?.logistics?.mealNotes)}
              disabled={isPending || isDisabled("logistics.mealNotes")}
              {...register("tripDetails.logistics.mealNotes")}
            />
          </FormField>
        )}
        <StringTagListField
          control={control}
          name="tripDetails.logistics.supportServices"
          label={t("trip_supportServicesLabel")}
          disabled={isPending}
          placeholder={ph("trip_supportServicesPlaceholder")}
          error={td?.logistics?.supportServices?.message as string | undefined}
        />
        <StringTagListField
          control={control}
          name="tripDetails.logistics.includedServices"
          label={t("trip_includedServicesLabel")}
          disabled={isPending}
          placeholder={ph("trip_supportServicesPlaceholder")}
          error={td?.logistics?.includedServices?.message as string | undefined}
        />
        <StringTagListField
          control={control}
          name="tripDetails.logistics.excludedServices"
          label={t("trip_excludedServicesLabel")}
          disabled={isPending}
          placeholder={ph("trip_supportServicesPlaceholder")}
          error={td?.logistics?.excludedServices?.message as string | undefined}
        />
        <StringTagListField
          control={control}
          name="tripDetails.logistics.optionalServices"
          label={t("trip_optionalServicesLabel")}
          disabled={isPending}
          placeholder={ph("trip_supportServicesPlaceholder")}
          error={td?.logistics?.optionalServices?.message as string | undefined}
        />
        {isHidden("logistics.guideLanguageIds") ? null : (
          <EquipmentIdsCheckboxField
            control={control}
            name="tripDetails.logistics.guideLanguageIds"
            label={labelWithRequiredness(t("trip_guideLanguagesLabel"), "logistics.guideLanguageIds")}
            description={mergeDescription(t("trip_guideLanguagesDescription"), "logistics.guideLanguageIds")}
            disabled={isPending || isDisabled("logistics.guideLanguageIds")}
            items={guideLanguageItems}
            loading={guideLanguagesQuery.isLoading}
            loadFailed={guideLanguagesQuery.isError}
            emptyHint={t("trip_guideLanguagesEmptyHint")}
            ariaGroupLabel={t("trip_guideLanguagesLabel")}
            error={td?.logistics?.guideLanguageIds?.message as string | undefined}
          />
        )}
        {isHidden("logistics.groupSizeMin") ? null : (
          <FormField
            label={labelWithRequiredness(t("trip_groupSizeMinLabel"), "logistics.groupSizeMin")}
            description={mergeDescription(undefined, "logistics.groupSizeMin")}
            error={td?.logistics?.groupSizeMin?.message as string | undefined}
          >
            <Controller
              control={control}
              name="tripDetails.logistics.groupSizeMin"
              render={({ field }) => (
                <PersianNumberInput
                  disabled={isDisabled("logistics.groupSizeMin")}
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
        )}
        {isHidden("logistics.groupSizeMax") ? null : (
          <FormField
            label={labelWithRequiredness(t("trip_groupSizeMaxLabel"), "logistics.groupSizeMax")}
            description={mergeDescription(undefined, "logistics.groupSizeMax")}
            error={td?.logistics?.groupSizeMax?.message as string | undefined}
          >
            <Controller
              control={control}
              name="tripDetails.logistics.groupSizeMax"
              render={({ field }) => (
                <PersianNumberInput
                  disabled={isDisabled("logistics.groupSizeMax")}
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
        )}
      </CollapsibleSection>

      <CollapsibleSection title={t("trip_sectionPolicies")}>
        <FormField label={t("trip_reservationRulesLabel")} error={td?.policies?.reservationRules?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.reservationRules)} disabled={isPending} {...register("tripDetails.policies.reservationRules")} />
        </FormField>
        <FormField label={t("trip_cancellationPolicyLabel")} error={td?.policies?.cancellationPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.cancellationPolicy)} disabled={isPending} {...register("tripDetails.policies.cancellationPolicy")} />
        </FormField>
        <FormField label={t("trip_refundPolicyLabel")} error={td?.policies?.refundPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.refundPolicy)} disabled={isPending} {...register("tripDetails.policies.refundPolicy")} />
        </FormField>
        <FormField label={t("trip_attendanceRulesLabel")} error={td?.policies?.attendanceRules?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.attendanceRules)} disabled={isPending} {...register("tripDetails.policies.attendanceRules")} />
        </FormField>
        <FormField label={t("trip_lateArrivalPolicyLabel")} error={td?.policies?.lateArrivalPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.lateArrivalPolicy)} disabled={isPending} {...register("tripDetails.policies.lateArrivalPolicy")} />
        </FormField>
        <FormField label={t("trip_noShowPolicyLabel")} error={td?.policies?.noShowPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.noShowPolicy)} disabled={isPending} {...register("tripDetails.policies.noShowPolicy")} />
        </FormField>
        <FormField label={t("trip_confirmationPolicyLabel")} error={td?.policies?.confirmationPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.confirmationPolicy)} disabled={isPending} {...register("tripDetails.policies.confirmationPolicy")} />
        </FormField>
        <FormField label={t("trip_capacityPolicyLabel")} error={td?.policies?.capacityPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.capacityPolicy)} disabled={isPending} {...register("tripDetails.policies.capacityPolicy")} />
        </FormField>
        <FormField label={t("trip_weatherPolicyLabel")} error={td?.policies?.weatherPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.weatherPolicy)} disabled={isPending} {...register("tripDetails.policies.weatherPolicy")} />
        </FormField>
        <FormField label={t("trip_safetyPolicyLabel")} error={td?.policies?.safetyPolicy?.message as string | undefined}>
          <Textarea rows={3} invalid={Boolean(td?.policies?.safetyPolicy)} disabled={isPending} {...register("tripDetails.policies.safetyPolicy")} />
        </FormField>
      </CollapsibleSection>
    </div>
  );
}
