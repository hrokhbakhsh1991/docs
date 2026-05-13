import type { CSSProperties } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";

import { Checkbox, FormField, Select } from "@tour/ui";

import type { TourCreateFormValues } from "../schemas/tourCreateSchema";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";

const mutedHelp: CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-neutral-600, #525252)",
  margin: 0,
};

/**
 * Phase 3 «Theme Details» shell: workspace theme catalog + main/secondary bindings.
 * (Other `basic_info` fields stay on {@link BasicInfoStep}.)
 */
export function ThemeDetailsStep() {
  const t = useTranslations("tours.new");
  const { control, getValues, setValue, formState: { errors } } = useFormContext<TourCreateFormValues>();

  const tourThemesQuery = useSettingsTourThemes();
  const themes = tourThemesQuery.data ?? [];
  const activeSorted = themes.filter((row) => row.isActive);
  const mainTourThemeId = useWatch({ control, name: "overview.mainTourThemeId" });

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <p style={{ ...mutedHelp, lineHeight: 1.55 }}>
        تم اصلی، پروفایل فرم ویزارد (کدام بخش‌ها دیده شوند) را از تنظیمات تم فضای کاری تعیین می‌کند. در صورت نیاز
        می‌توانید چند تم فرعی هم اضافه کنید؛ سپس با «بعدی» به قیمت و ظرفیت بروید.
      </p>

      <FormField
        label="تم اصلی"
        description={
          <span style={{ display: "block", marginTop: "0.2rem", ...mutedHelp }}>{t("trip_tourThemesDescription")}</span>
        }
        error={errors.overview?.mainTourThemeId?.message}
      >
        <Controller
          control={control}
          name="overview.mainTourThemeId"
          render={({ field }) => (
            <>
              {tourThemesQuery.isLoading ? <p style={mutedHelp}>{t("trip_tourThemesLoading")}</p> : null}
              {!tourThemesQuery.isLoading && tourThemesQuery.isError ? (
                <p style={{ color: "var(--color-danger-600, #b91c1c)", fontSize: "0.875rem" }} role="alert">
                  {t("trip_tourThemesLoadError")}
                </p>
              ) : null}
              {!tourThemesQuery.isLoading && !tourThemesQuery.isError && activeSorted.length === 0 ? (
                <p style={mutedHelp}>{t("trip_tourThemesEmptyHint")}</p>
              ) : null}
              {!tourThemesQuery.isLoading && !tourThemesQuery.isError && activeSorted.length > 0 ? (
                <Select
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = v === "" ? undefined : v;
                    field.onChange(next);
                    if (next) {
                      const secondary = getValues("overview.secondaryTourThemeIds") ?? [];
                      const filtered = secondary.filter((id) => id !== next);
                      if (filtered.length !== secondary.length) {
                        setValue("overview.secondaryTourThemeIds", filtered, { shouldValidate: true });
                      }
                    }
                  }}
                >
                  <option value="">انتخاب تم اصلی</option>
                  {activeSorted.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </Select>
              ) : null}
            </>
          )}
        />
      </FormField>

      <FormField
        label="تم‌های فرعی"
        description="می‌توانید چند مورد را همزمان انتخاب کنید (تم اصلی در این فهرست نمایش داده نمی‌شود)."
        error={
          typeof errors.overview?.secondaryTourThemeIds?.message === "string"
            ? errors.overview.secondaryTourThemeIds.message
            : undefined
        }
      >
        <Controller
          control={control}
          name="overview.secondaryTourThemeIds"
          render={({ field }) => {
            const selected = Array.isArray(field.value) ? field.value : [];
            const secondaryOptions = activeSorted.filter((row) => row.id !== mainTourThemeId);
            return (
              <>
                {tourThemesQuery.isLoading ? <p style={mutedHelp}>{t("trip_tourThemesLoading")}</p> : null}
                {!tourThemesQuery.isLoading && tourThemesQuery.isError ? (
                  <p style={{ color: "var(--color-danger-600, #b91c1c)", fontSize: "0.875rem" }} role="alert">
                    {t("trip_tourThemesLoadError")}
                  </p>
                ) : null}
                {!tourThemesQuery.isLoading && !tourThemesQuery.isError && secondaryOptions.length === 0 ? (
                  <p style={mutedHelp}>
                    {mainTourThemeId && activeSorted.length === 1
                      ? "فقط یک تم فعال دارید؛ پس از افزودن تم‌های بیشتر در تنظیمات می‌توانید تم فرعی انتخاب کنید."
                      : t("trip_tourThemesEmptyHint")}
                  </p>
                ) : null}
                {!tourThemesQuery.isLoading && !tourThemesQuery.isError && secondaryOptions.length > 0 ? (
                  <div
                    role="group"
                    aria-label="تم‌های فرعی"
                    onBlur={field.onBlur}
                    ref={field.ref}
                    style={{ display: "grid", gap: "0.45rem" }}
                  >
                    {secondaryOptions.map((row) => (
                      <Checkbox
                        key={row.id}
                        label={row.name}
                        checked={selected.includes(row.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) {
                            next.add(row.id);
                          } else {
                            next.delete(row.id);
                          }
                          const catalogOrder = secondaryOptions.map((r) => r.id).filter((id) => next.has(id));
                          const extra = [...next].filter((id) => !secondaryOptions.some((r) => r.id === id));
                          field.onChange([...catalogOrder, ...extra]);
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            );
          }}
        />
      </FormField>
    </div>
  );
}
