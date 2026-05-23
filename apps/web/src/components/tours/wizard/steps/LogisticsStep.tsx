import { ACCOMMODATION_TYPE_VALUES } from "@repo/types";
import { useTranslations } from "next-intl";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Checkbox, FormField, Input, Textarea } from "@tour/ui";

import type { TourCreateFormValues } from "../schemas/tourCreateSchema";
import { useSettingsGuideLanguages } from "@/hooks/use-settings-guide-languages";
import { LogisticsServiceListFields } from "@/features/tours/wizard/groups/logistics/LogisticsServiceListFields";
import { LogisticsTransportFields } from "@/features/tours/wizard/groups/logistics/LogisticsTransportFields";
import { DenaliGatheringPointsWidget } from "@/features/tours/wizard/denali/components/DenaliGatheringPointsWidget";
import { FieldGate, useIsFieldRecommended } from "@/features/tours/wizard/profileRulesReact";
import type { WizardFieldPath } from "@/features/tours/wizard/profileRules/types";

/**
 * Stable, typed field-path constants used both for visibility gating (`<FieldGate>`) and for
 * required-ness lookups (`useIsFieldRequired`). Centralizing them here keeps the rules-layer
 * integration easy to audit and avoids string typos.
 *
 * The transport sub-cluster (`primaryTransportMode`, `supplementalPrivateCar`,
 * `fuelShareToman`) is owned by `LogisticsTransportFields` and gates internally — see that
 * component for its own `<FieldGate>` wiring.
 */
const PATHS = {
  includedServices: "logistics.includedServices" as WizardFieldPath,
  leaderProvidesInsurance: "logistics.leaderProvidesInsurance" as WizardFieldPath,
  leaderInsuranceNotes: "logistics.leaderInsuranceNotes" as WizardFieldPath,
  excludedServices: "logistics.excludedServices" as WizardFieldPath,
  meetingPointDetails: "logistics.meetingPointDetails" as WizardFieldPath,
  transportationDetails: "logistics.transportationDetails" as WizardFieldPath,
  transportationNotes: "logistics.transportationNotes" as WizardFieldPath,
  accommodationDetails: "logistics.accommodationDetails" as WizardFieldPath,
  accommodationTypes: "logistics.accommodationTypes" as WizardFieldPath,
  accommodationNotes: "logistics.accommodationNotes" as WizardFieldPath,
  mealPlan: "logistics.mealPlan" as WizardFieldPath,
  mealNotes: "logistics.mealNotes" as WizardFieldPath,
  guideLanguageIds: "logistics.guideLanguageIds" as WizardFieldPath,
  groupSizeMin: "logistics.groupSizeMin" as WizardFieldPath,
  groupSizeMax: "logistics.groupSizeMax" as WizardFieldPath,
} as const;

const mutedHelp = {
  fontSize: "0.8125rem",
  color: "var(--color-neutral-600, #525252)",
  margin: 0,
} as const;

export function LogisticsStep() {
  const t = useTranslations("tours.new");
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<TourCreateFormValues>();
  const leaderProvidesInsurance = useWatch({ control, name: "logistics.leaderProvidesInsurance" });
  const guideLanguagesQuery = useSettingsGuideLanguages();
  const guideLanguageItems = (guideLanguagesQuery.data ?? [])
    .filter((row) => row.isActive)
    .map((row) => ({ id: row.id, name: row.name }));

  // Phase P12 UI fold-in — surface the "recommended" tier from the descriptor's mountain
  // Edit presets as a non-blocking badge in the wizard label. Tier propagation happens in
  // `profileRules/rules.ts` (PROFILE_FIELD_REQUIRED_OVERRIDES); the badge text comes from the
  // i18n table `tours.new.wizardFieldHintRecommended`.
  const recommendedLabel = t("wizardFieldHintRecommended");
  const transportationNotesRecommended = useIsFieldRecommended(PATHS.transportationNotes);
  const groupSizeMinRecommended = useIsFieldRecommended(PATHS.groupSizeMin);
  const groupSizeMaxRecommended = useIsFieldRecommended(PATHS.groupSizeMax);

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <LogisticsTransportFields />

      <DenaliGatheringPointsWidget name="logistics.gatheringPoints" />

      <FieldGate field={PATHS.includedServices}>
        <FormField
          label="خدمات شامل"
          description="خدمات و امکاناتی که در قیمت تور لحاظ شده‌اند؛ می‌توانید چند مورد را در چند خط بنویسید."
        >
          <Textarea
            rows={3}
            {...register("logistics.includedServices")}
            placeholder={"مثل: رفت و برگشت با مینی‌بوس تا مبدا\nاقامت یک شب کمپ یا خانه محلی\nیک وعده شام یا ناهار روز اول"}
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.leaderProvidesInsurance}>
        <FormField
          label="بیمه از سوی برگزارکننده"
          description="جدا از الزام «بیمه ورزشی شخصی» در گام «شرایط شرکت»؛ اینجا فقط مشخص کنید خود برنامه پوششی برای گروه دارد یا نه."
        >
          <Controller
            control={control}
            name="logistics.leaderProvidesInsurance"
            render={({ field }) => (
              <Checkbox
                label="این تور شامل پوشش بیمه‌ای (مثلاً مسئولیت یا حوادث) از سوی برگزارکننده است."
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
                onBlur={field.onBlur}
                ref={field.ref}
                name={field.name}
              />
            )}
          />
        </FormField>
      </FieldGate>

      {leaderProvidesInsurance ? (
        <FieldGate field={PATHS.leaderInsuranceNotes}>
          <FormField
            label="توضیح کوتاه بیمه برگزارکننده"
            description="نوع پوشش، سقف رضایتنامه، موارد خارج از تعهد و هر چیز لازم برای شفاف‌سازی را بنویسید."
          >
            <Textarea
              rows={2}
              {...register("logistics.leaderInsuranceNotes")}
              placeholder="مثل: پوشش حوادث گروهی تا سقف مشخص؛ بیماری‌های قبلی یا فعالیت‌های پرریسک تحت پوشش نیست."
            />
          </FormField>
        </FieldGate>
      ) : null}

      <FieldGate field={PATHS.excludedServices}>
        <FormField
          label="خدمات غیرشامل"
          description="هر چه مسافر باید جداگانه بپردازد یا خارج از قرارداد تور است؛ چند خط پذیراست."
        >
          <Textarea
            rows={3}
            {...register("logistics.excludedServices")}
            placeholder={"مثل: ورودی اماکن\nکرایه قاطر یا حمل وسایل شخصی\nهزینه اقامت یا غذاهای خارج از برنامه"}
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.meetingPointDetails}>
        <FormField
          label="جزئیات نقطه ملاقات"
          description="محل، ساعت تجمع و نشانهٔ دقیق؛ مکمل فیلدهای «مکان» در گام تاریخ و مقصد است اگر نیاز دارید جزئی تر بنویسید."
        >
          <Textarea
            rows={2}
            {...register("logistics.meetingPointDetails")}
            placeholder={"مثل: ساعت چهار و سی دقیقه بامداد، پارک شمال — کنار پارکینگ پمپ بنزین\nشماره تماس هماهنگی: …"}
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.transportationDetails}>
        <FormField
          label="جزئیات حمل‌ونقل"
          description="برنامهٔ اجرایی جابجایی بین شهرها تا مبدأ و وسایل نقلیه؛ حالت «چه اتفاقی می‌افتد»."
        >
          <Textarea
            rows={2}
            {...register("logistics.transportationDetails")}
            placeholder={"مثل: حرکت از تهران با دو مینی‌بوس\nمسیر بین روستا تا پناهگاه با خودرو نیسان محلی"}
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.transportationNotes}>
        <FormField
          label="یادداشت حمل‌ونقل"
          description="محدودیت‌ها، احتمال تأخیر، یا توصیه‌های ایمنی مربوط به راه؛ نه خود برنامهٔ دقیق."
          recommendedLabel={transportationNotesRecommended ? recommendedLabel : undefined}
        >
          <Textarea
            rows={2}
            {...register("logistics.transportationNotes")}
            placeholder={"مثل: در صورت برف جاده ممکن است نیم تا یک ساعت تاخیر داشته باشد\nوسیله نقلیه شخصی تا پارکینگ مبدا توصیه نمی‌شود"}
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.accommodationDetails}>
        <FormField
          label="جزئیات اقامت"
          description="محل شب‌نشینی، مدل کمپ یا اقامتگاه و سطح آسایش به‌صورت خلاصه."
        >
          <Textarea
            rows={2}
            {...register("logistics.accommodationDetails")}
            placeholder={"مثل: شب اول اقامتگاه محلی اشتراکی\nشب دوم کمپ زیر باران‌بند؛ کیسه‌خواب شخصی الزام است"}
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.accommodationTypes}>
        <FormField
          label="نوع اقامت"
          description="چند گزینه را می‌توانید هم‌زمان انتخاب کنید (مثلاً اقامتگاه و چادر). جزئیات متنی را در «جزئیات اقامت» یا «یادداشت اقامت» بنویسید."
          error={errors.logistics?.accommodationTypes?.message as string | undefined}
        >
          <Controller
            control={control}
            name="logistics.accommodationTypes"
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
                    checked={(field.value ?? []).includes(slug)}
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
                    onBlur={field.onBlur}
                  />
                ))}
              </div>
            )}
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.accommodationNotes}>
        <FormField
          label="یادداشت اقامت"
          description="نکات تجربه‌مسافر مانند امکانات بهداشتی، برق، یا سکوت شب؛ نه شکل کلی کمپ که در جزئیات اقامت است."
        >
          <Textarea
            rows={2}
            {...register("logistics.accommodationNotes")}
            placeholder={"مثل: دستشویی و حمام مشترک است\nبه‌دلیل ارتفاع شب‌ها سرد است؛ لایه‌گرم مناسب بیاورید"}
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.mealPlan}>
        <FormField
          label="برنامه غذایی"
          description="خلاصه وعده‌ها در طول تور یا روزهای مشخص؛ اگر جزئی نشد برای قدم بعد کافی است."
        >
          <Input
            type="text"
            {...register("logistics.mealPlan")}
            placeholder="مثل: صبحانه روز دوم و ناهار بستهٔ روز سوم"
          />
        </FormField>
      </FieldGate>

      <FieldGate field={PATHS.mealNotes}>
        <FormField
          label="یادداشت غذا"
          description="رژیم‌ها، آلرژی‌ها، تهیه خارج از برنامه یا نکاتی که باید از قبل هماهنگ شود."
        >
          <Textarea
            rows={2}
            {...register("logistics.mealNotes")}
            placeholder={
              "مثل: برای غذای گیاهی حداقل سه روز قبل اطلاع دهید؛ برخی مسیرها فروشنده ندارند؛ آب آشامیدنی همراه داشته باشید."
            }
          />
        </FormField>
      </FieldGate>

      <LogisticsServiceListFields />

      <FieldGate field={PATHS.guideLanguageIds}>
        <FormField
          label="زبان‌های راهنما (از تنظیمات)"
          description="زبان‌هایی که راهنما یا لیدر در ارتباط با گروه استفاده می‌کند؛ از فهرست فعال تنظیمات انتخاب کنید."
        >
          <Controller
            control={control}
            name="logistics.guideLanguageIds"
            render={({ field }) => {
              const selected = new Set(Array.isArray(field.value) ? field.value : []);
              const toggle = (id: string) => {
                const next = new Set(selected);
                if (next.has(id)) {
                  next.delete(id);
                } else {
                  next.add(id);
                }
                const ordered = guideLanguageItems.map((row) => row.id).filter((rowId) => next.has(rowId));
                field.onChange(ordered);
              };
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {guideLanguagesQuery.isLoading ? <p style={mutedHelp}>در حال بارگذاری زبان‌ها…</p> : null}
                  {!guideLanguagesQuery.isLoading && guideLanguagesQuery.isError ? (
                    <p style={{ color: "var(--color-danger-600, #b91c1c)", fontSize: "0.875rem" }} role="alert">
                      بارگذاری زبان‌های راهنما ناموفق بود.
                    </p>
                  ) : null}
                  {!guideLanguagesQuery.isLoading && !guideLanguagesQuery.isError && guideLanguageItems.length === 0 ? (
                    <p style={mutedHelp}>هیچ زبان راهنمای فعالی در تنظیمات تعریف نشده است.</p>
                  ) : null}
                  {!guideLanguagesQuery.isLoading && !guideLanguagesQuery.isError && guideLanguageItems.length > 0 ? (
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                      role="group"
                      aria-label="زبان‌های راهنما"
                    >
                      {guideLanguageItems.map((row) => (
                        <Checkbox key={row.id} label={row.name} checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }}
          />
        </FormField>
      </FieldGate>

      {/* Group-size fields live on the logistics root but are edited via the `capacity` step
          (per BASE_FIELD_RULES). They're kept here for visual co-location with the rest of
          logistics; the rules layer reports them as `belongsToStep === "capacity"`. */}
      <FormField
        label="حداقل اندازه گروه"
        description="حداقل تعداد نفر برای اجرای تور؛ اگر خالی بماند در سمت سرور الزامی نشده تلقی می‌شود."
        recommendedLabel={groupSizeMinRecommended ? recommendedLabel : undefined}
      >
        <Input type="number" inputMode="numeric" {...register("logistics.groupSizeMin", { valueAsNumber: true })} placeholder="مثلاً ۶" />
      </FormField>

      <FormField
        label="حداکثر اندازه گروه"
        description="سقف نفر قبل از قطع ظرفیت؛ برای رعایت الزام طرح، کمتر یا مساوی ظرفیت اصلی تور تنظیم کنید."
        recommendedLabel={groupSizeMaxRecommended ? recommendedLabel : undefined}
      >
        <Input type="number" inputMode="numeric" {...register("logistics.groupSizeMax", { valueAsNumber: true })} placeholder="مثلاً ۱۴" />
      </FormField>
    </div>
  );
}
