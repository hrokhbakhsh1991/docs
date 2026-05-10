import { Controller, useFormContext } from "react-hook-form";
import { Checkbox, FormField, Input, Select, Textarea } from "@tour/ui";

import type { TourCreateFormValues } from "../schemas/tourCreateSchema";
import {
  EXPERIENCE_LEVEL_LABELS,
  FITNESS_LEVEL_LABELS,
  GENDER_RESTRICTION_LABELS,
} from "../participationLabels";
import { DIFFICULTY_LEVELS, EXPERIENCE_LEVELS, GENDER_RESTRICTIONS } from "@/features/tours/models/tourTripDetails.schema";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { useSettingsEquipment } from "@/hooks/use-settings-equipment";

const mutedHelp = {
  fontSize: "0.8125rem",
  color: "var(--color-neutral-600, #525252)",
  margin: 0,
} as const;

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
}: {
  control: ReturnType<typeof useFormContext<TourCreateFormValues>>["control"];
  name: "participation.gearRequiredIds" | "participation.gearOptionalIds";
  label: string;
  description?: string;
  error?: string;
  disabled: boolean;
  items: { id: string; name: string }[];
  loading: boolean;
  loadFailed: boolean;
}) {
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
            {loading ? <p style={mutedHelp}>در حال بارگذاری تجهیزات…</p> : null}
            {!loading && loadFailed ? (
              <p style={{ color: "var(--color-danger-600, #b91c1c)", fontSize: "0.875rem" }} role="alert">
                بارگذاری تجهیزات ناموفق بود.
              </p>
            ) : null}
            {!loading && !loadFailed && items.length === 0 ? (
              <p style={mutedHelp}>هیچ تجهیز فعالی در تنظیمات تعریف نشده است.</p>
            ) : null}
            {!loading && !loadFailed && items.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }} role="group" aria-label={label}>
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

export function ParticipationStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<TourCreateFormValues>();
  const equipmentQuery = useSettingsEquipment();
  const equipmentItems = (equipmentQuery.data ?? [])
    .filter((row) => row.isActive)
    .map((row) => ({ id: row.id, name: row.name }));

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <p style={{ ...mutedHelp, gridColumn: "1 / -1" }}>
        <strong style={{ fontWeight: 600, color: "var(--color-neutral-700, #404040)" }}>کجا شرط قبول شرکت کننده را می‌نویسم؟</strong>
        شرایط عمومی مانند حداقل سابقه صعود (مثلاً «حداقل چهار قله بالای ۴۰۰۰ متر») یا مدارک اجباری را در فیلد «الزامات» یا در فهرست «مهارت‌ها و پیش‌نیازها» با هر مورد در یک خط مشخص کنید.
        مهارت‌های فنی کوتاه (مثل کار با طناب) را می‌توانید جداگانه در «مهارت فنی موردنیاز» خلاصه کنید.
      </p>

      <FormField
        label="الزام بیمه ورزشی شخصی"
        description="اگر فعال باشد، شرکت تنها با داشتن بیمه ورزشی معتبر مجاز است؛ جزئیات را در «مدارک» یا «الزامات» هم می‌توانید بنویسید. بیمه‌ای که برگزارکننده در بسته تور ارائه می‌دهد در گام «لجستیک و خدمات» جداگانه مشخص می‌شود."
      >
        <Controller
          control={control}
          name="participation.sportsInsuranceRequired"
          render={({ field }) => (
            <Checkbox
              label="شرکت در این تور تنها با داشتن بیمه ورزشی معتبر الزامی است."
              checked={Boolean(field.value)}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            />
          )}
        />
      </FormField>

      <FormField
        label="الزام کد ملی در ثبت‌نام"
        description="اگر فعال باشد، فقط کاربرانی که با نشست وارد شده‌اند و در پروفایل‌شان کد ملی ثبت کرده‌اند می‌توانند در این تور ثبت‌نام یا به لیست انتظار بروند."
      >
        <Controller
          control={control}
          name="participation.registrationNationalIdRequired"
          render={({ field }) => (
            <Checkbox
              label="برای ثبت‌نام در این تور، تکمیل کد ملی در پروفایل الزامی است."
              checked={Boolean(field.value)}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            />
          )}
        />
      </FormField>

      <FormField
        label="سطح تجربه موردنیاز"
        description="سطح تجربه کلی شرکت؛ اگر نامشخص بماند در سامانه پر نمی‌شود."
        error={errors.participation?.requiredExperienceLevel?.message}
      >
        <Controller
          control={control}
          name="participation.requiredExperienceLevel"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              invalid={Boolean(errors.participation?.requiredExperienceLevel)}
              aria-invalid={Boolean(errors.participation?.requiredExperienceLevel)}
            >
              <option value="">انتخاب کنید (اختیاری)</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {EXPERIENCE_LEVEL_LABELS[level]}
                </option>
              ))}
            </Select>
          )}
        />
      </FormField>

      <FormField
        label="سطح آمادگی جسمانی"
        description="سطح سختی فیزیکی مسیر؛ گزینه «فنی» برای مسیرهایی است که مهارت ویژه لازم دارد."
        error={errors.participation?.requiredFitnessLevel?.message}
      >
        <Controller
          control={control}
          name="participation.requiredFitnessLevel"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              invalid={Boolean(errors.participation?.requiredFitnessLevel)}
              aria-invalid={Boolean(errors.participation?.requiredFitnessLevel)}
            >
              <option value="">انتخاب کنید (اختیاری)</option>
              {DIFFICULTY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {FITNESS_LEVEL_LABELS[level]}
                </option>
              ))}
            </Select>
          )}
        />
      </FormField>

      <FormField label="حداقل سن" error={errors.participation?.minimumAge?.message} description="اگر بدون محدودیت باشد خالی بگذارید.">
        <Controller
          control={control}
          name="participation.minimumAge"
          render={({ field }) => (
            <PersianNumberInput
              numericMode="integer"
              value={field.value ?? ""}
              onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="مثلاً ۱۸"
            />
          )}
        />
      </FormField>

      <FormField label="حداکثر سن" error={errors.participation?.maximumAge?.message} description="اگر برای سن سقف ندارید، خالی بگذارید.">
        <Controller
          control={control}
          name="participation.maximumAge"
          render={({ field }) => (
            <PersianNumberInput
              numericMode="integer"
              value={field.value ?? ""}
              onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="مثلاً ۶۵"
            />
          )}
        />
      </FormField>

      <FormField
        label="محدودیت جنسیت"
        description="انتخاب «بدون محدودیت» یعنی همه مجاز؛ خالی مانده یعنی در این مرحله صریح نکرده‌اید."
        error={errors.participation?.genderRestriction?.message}
      >
        <Controller
          control={control}
          name="participation.genderRestriction"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              invalid={Boolean(errors.participation?.genderRestriction)}
              aria-invalid={Boolean(errors.participation?.genderRestriction)}
            >
              <option value="">انتخاب کنید (اختیاری)</option>
              {GENDER_RESTRICTIONS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_RESTRICTION_LABELS[g]}
                </option>
              ))}
            </Select>
          )}
        />
      </FormField>

      <FormField
        label="مهارت فنی موردنیاز"
        description="خلاصه یک‌خط یا کوتاه از مهارت فنی؛ نه کل شرایط قبول."
      >
        <Input
          type="text"
          placeholder="مثل: کار با ابزار یخ‌نوردی؛ فرود سیال با هشت؛ آشنایی با کار طناب ثابت"
          {...register("participation.technicalSkillRequired")}
        />
      </FormField>

      <FormField
        label="محدودیت‌های پزشکی"
        description="مواردی که شرکت کننده باید از قبل بداند (بدون تشخیص پزشکی)."
      >
        <Textarea
          rows={2}
          placeholder="مثل: نامناسب برای افراد مبتلا به مشکلات حاد قلبی ـ تنفسی؛ لازم است وضعیت سلامت را با راهبلد هماهنگ کنید."
          {...register("participation.medicalRestrictions")}
        />
      </FormField>

      <FormField
        label="الزامات (شرایط پذیرش)"
        description="متن آزاد برای شرایط عمومی قبول؛ مثال: حداقل چهار صعود قبلی بالای چهارهزار متر؛ همراه داشتن گواهی پزشک."
      >
        <Textarea
          rows={3}
          placeholder="مثل: شرکت تنها برای کسانی که حداقل چهار قله بالای ۴۰۰۰ متر با سربار را صعود کرده باشند؛ ارائه رزومه صعود الزامی است."
          {...register("participation.requirements")}
        />
      </FormField>

      <FormField
        label="مهارت‌ها و پیش‌نیازها"
        description="هر شرط یا مهارت را در یک خط؛ می‌توانید همان الزام صعود قبلی را اینجا به‌صورت فهرست بنویسید."
      >
        <Controller
          control={control}
          name="participation.skillsRequired"
          render={({ field }) => (
            <Textarea
              rows={3}
              placeholder={`هر خط یک مورد؛ مثل:
صعود حداقل چهار قله بالای ۴۰۰۰ متر با سربار
تسلط به فرود سیال با هشت
تجربه شب‌مانی در ارتفاع`}
              value={(field.value ?? []).join("\n")}
              onChange={(e) => field.onChange(e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
      </FormField>

      <EquipmentIdsCheckboxField
        control={control}
        name="participation.gearRequiredIds"
        label="تجهیزات الزامی (از تنظیمات)"
        description="هر مورد فعال در تنظیمات تجهیزات؛ شرکت کننده بدون این‌ها مجاز نیست."
        error={errors.participation?.gearRequiredIds?.message as string | undefined}
        disabled={false}
        items={equipmentItems}
        loading={equipmentQuery.isLoading}
        loadFailed={equipmentQuery.isError}
      />

      <EquipmentIdsCheckboxField
        control={control}
        name="participation.gearOptionalIds"
        label="تجهیزات پیشنهادی"
        description="مواردی که داشتنشان کمک می‌کند ولی الزام سیستمی نیست."
        error={errors.participation?.gearOptionalIds?.message as string | undefined}
        disabled={false}
        items={equipmentItems}
        loading={equipmentQuery.isLoading}
        loadFailed={equipmentQuery.isError}
      />

      <FormField label="مدارک موردنیاز" description="هر خط یک نوع سند؛ مثل کارت ملی یا گزارش کوهنوردی رسمی.">
        <Controller
          control={control}
          name="participation.documentsRequired"
          render={({ field }) => (
            <Textarea
              rows={2}
              placeholder={"مثل: تصویر کارت ملی\nرزومه صعود تأییدشده یا گزارش رسمی باشگاه کوهنوردی"}
              value={(field.value ?? []).join("\n")}
              onChange={(e) => field.onChange(e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
      </FormField>

      <FormField label="مناسب برای" description="هر خط یک گروه یا توصیف؛ برای نمایش به مسافر.">
        <Controller
          control={control}
          name="participation.suitableFor"
          render={({ field }) => (
            <Textarea
              rows={2}
              placeholder={"مثل: کوهنوردان با سابقه ارتفاع\nافراد با آمادگی جسمانی خوب در هفته سه تا چهار جلسه ورزشی"}
              value={(field.value ?? []).join("\n")}
              onChange={(e) => field.onChange(e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
      </FormField>

      <FormField label="نامناسب برای" description="طبق دستور خودتان؛ هر خط یک مورد برای شفاف‌سازی.">
        <Controller
          control={control}
          name="participation.notSuitableFor"
          render={({ field }) => (
            <Textarea
              rows={2}
              placeholder={"مثل: خانم‌های باردار\nکودکان زیر پانزده سال بدون تجربه ارتفاع"}
              value={(field.value ?? []).join("\n")}
              onChange={(e) => field.onChange(e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
      </FormField>
    </div>
  );
}