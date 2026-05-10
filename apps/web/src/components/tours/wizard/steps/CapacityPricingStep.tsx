import { Controller, useFormContext } from "react-hook-form";
import { Checkbox, FormField } from "@tour/ui";

import type { TourCreateFormValues } from "../schemas/tourCreateSchema";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";

export function CapacityPricingStep() {
  const {
    control,
    formState: { errors },
  } = useFormContext<TourCreateFormValues>();

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <FormField
        label="پذیرش خودکار ثبت‌نام"
        description="اگر فعال باشد، درخواست شرکت بدون تأیید دستی راهبر بلافاصله به‌عنوان «پذیرفته‌شده» ثبت می‌شود و در ظرفیت تور می‌نشیند. با خاموش کردن، ابتدا در وضعیت «در انتظار تأیید» می‌ماند تا در پنل راهبر تأیید شود."
      >
        <Controller
          control={control}
          name="autoAcceptRegistrations"
          render={({ field }) => (
            <Checkbox
              label="ثبت‌نام‌ها بدون تأیید دستی مستقیماً در تور پذیرفته شوند."
              checked={field.value !== false}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            />
          )}
        />
      </FormField>

      <FormField label="قیمت پایه (تومان)" description="قیمت را به تومان وارد کنید." error={errors.pricing?.basePrice?.message}>
        <Controller
          name="pricing.basePrice"
          control={control}
          render={({ field }) => (
            <PersianNumberInput
              numericMode="decimal"
              formatThousands
              value={field.value ?? ""}
              onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          )}
        />
      </FormField>

      <FormField label="واحد پول">
        <div
          style={{
            border: "1px solid var(--color-border-subtle, #d1d5db)",
            borderRadius: 8,
            padding: "0.55rem 0.7rem",
            background: "var(--color-surface-subtle, #f8fafc)",
            color: "#334155",
          }}
        >
          تومان (ثابت)
        </div>
      </FormField>
    </div>
  );
}
