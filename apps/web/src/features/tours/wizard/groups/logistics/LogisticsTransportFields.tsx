"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Checkbox, FormField, Select } from "@tour/ui";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { FieldGate, useIsFieldRequired } from "@/features/tours/wizard/profileRulesReact";
import type { WizardFieldPath } from "@/features/tours/wizard/profileRules/types";

const PATHS = {
  primaryTransportMode: "logistics.primaryTransportMode" as WizardFieldPath,
  supplementalPrivateCar: "logistics.supplementalPrivateCar" as WizardFieldPath,
  fuelShareToman: "logistics.fuelShareToman" as WizardFieldPath,
} as const;

/**
 * Owns the `logistics.*` transport sub-cluster:
 *   - `logistics.primaryTransportMode` (enum select with empty sentinel)
 *   - `logistics.supplementalPrivateCar` (boolean checkbox; conditionally rendered)
 *   - `logistics.fuelShareToman`         (numeric input; conditionally rendered)
 *
 * Cross-field side-effects preserved verbatim from the legacy `LogisticsStep.tsx`:
 *   1. When `primaryTransportMode` is set to `"private_car"`, `supplementalPrivateCar` is reset
 *      to `false` via `setValue(..., { shouldValidate: true, shouldDirty: true })`.
 *   2. When `supplementalPrivateCar` is unchecked, `fuelShareToman` is cleared (`undefined`).
 *   3. The fuel-share field is visible iff `primaryTransportMode === "private_car"` **or**
 *      `supplementalPrivateCar === true` — the description text also varies on that condition.
 *
 * Coupling (documented for future refactors):
 * - Requires a parent `FormProvider<TourCreateFormValues>` (consumed via `useFormContext`).
 * - Depends on the Zod-validated shape of `logistics.{primaryTransportMode,supplementalPrivateCar,
 *   fuelShareToman}` matching the wizard schema; `""` → `undefined` is preserved for the select.
 * - Profile awareness flows through the rules layer: every sub-field is wrapped in
 *   `<FieldGate>` so an `urban_event` profile (where `logistics` is hidden at the rail) never
 *   renders these inputs. `aria-required` on the primary-transport select is sourced from
 *   `useIsFieldRequired("logistics.primaryTransportMode")` — no ad-hoc `if (profile === ...)`.
 *
 * TODO (future): when `OptionalEnumSelectField` and `PersianNumberControllerField` primitives land
 * (per design §2), the inner `<Controller>` blocks below can be reduced to single calls.
 */
export function LogisticsTransportFields() {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<TourCreateFormValues>();
  const primaryTransportMode = useWatch({ control, name: "logistics.primaryTransportMode" });
  const supplementalPrivateCar = useWatch({ control, name: "logistics.supplementalPrivateCar" });
  const reqPrimaryTransport = useIsFieldRequired(PATHS.primaryTransportMode);

  return (
    <>
      <FieldGate field={PATHS.primaryTransportMode}>
        <FormField
          label="حمل‌ونقل اصلی سفر"
          description="مسیر اصلی اجرای تور را انتخاب کنید. ریزمسیرهای محلی را در برنامه سفر یا یادداشت لجستیک بیاورید."
          error={errors.logistics?.primaryTransportMode?.message}
        >
          <Controller
            control={control}
            name="logistics.primaryTransportMode"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "private_car") {
                    setValue("logistics.supplementalPrivateCar", false, { shouldValidate: true, shouldDirty: true });
                  }
                  field.onChange(v === "" ? undefined : v);
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                invalid={Boolean(errors.logistics?.primaryTransportMode)}
                aria-invalid={Boolean(errors.logistics?.primaryTransportMode)}
                aria-required={reqPrimaryTransport || undefined}
              >
                <option value="">انتخاب کنید</option>
                <option value="plane">هواپیما</option>
                <option value="train">قطار</option>
                <option value="bus">اتوبوس</option>
                <option value="midibus">میدل‌باس</option>
                <option value="private_car">ماشین شخصی</option>
              </Select>
            )}
          />
        </FormField>
      </FieldGate>

      {primaryTransportMode && primaryTransportMode !== "private_car" ? (
        <FieldGate field={PATHS.supplementalPrivateCar}>
          <FormField
            label="خودرو شخصی در کنار حمل اصلی"
            description="مثلاً بخشی از مسیر با اتوبوس گروهی است، ولی امکان یا نیاز به همراهی با خودرو شخصی (سرنشین، آخر مسیر، کاروان) هم وجود دارد."
            error={
              typeof errors.logistics?.supplementalPrivateCar?.message === "string"
                ? errors.logistics.supplementalPrivateCar.message
                : undefined
            }
          >
            <Controller
              control={control}
              name="logistics.supplementalPrivateCar"
              render={({ field }) => (
                <Checkbox
                  label="بله — علاوه بر حمل انتخاب‌شده، خودرو شخصی هم در برنامه هست."
                  checked={Boolean(field.value)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    field.onChange(checked);
                    if (!checked) {
                      setValue("logistics.fuelShareToman", undefined, { shouldValidate: true, shouldDirty: true });
                    }
                  }}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  name={field.name}
                />
              )}
            />
          </FormField>
        </FieldGate>
      ) : null}

      {primaryTransportMode === "private_car" || supplementalPrivateCar ? (
        <FieldGate field={PATHS.fuelShareToman}>
          <FormField
            label="دنگ بنزین برای هر سرنشین (تومان)"
            description={
              primaryTransportMode === "private_car"
                ? "این مبلغ جدا از قیمت پایه تور است و برای شرکت‌کننده‌هایی است که خودرو ندارند و به‌صورت سرنشین می‌آیند."
                : "برای شرکت‌کنندگانی که با خودرو شخصی در بخش مربوطه همراه می‌شوند یا به‌صورت سرنشین دنگ می‌پردازند."
            }
            error={errors.logistics?.fuelShareToman?.message}
          >
            <Controller
              control={control}
              name="logistics.fuelShareToman"
              render={({ field }) => (
                <PersianNumberInput
                  numericMode="integer"
                  formatThousands
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  placeholder="مثلاً ۳۰۰٬۰۰۰"
                />
              )}
            />
          </FormField>
        </FieldGate>
      ) : null}
    </>
  );
}
