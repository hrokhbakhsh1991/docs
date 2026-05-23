"use client";

import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { FieldErrors, FieldValues } from "react-hook-form";

import { Card, CardBody, CardHeader, CardTitle, FormField, Input, Select, Textarea } from "@tour/ui";

import type {
  TourLocationDestinationOption,
  TourLocationRegionOption,
} from "../constants/tour-location-mock-options";

export interface TourLocationSectionProps {
  regions: TourLocationRegionOption[];
  destinations: TourLocationDestinationOption[];
  /** When true, region / main destination pickers are hidden (e.g. workspace destination is chosen above). */
  hideRegionDestinationPickers?: boolean;
  /** When true, legacy logistics meeting/return text fields are hidden (Denali map zones used instead). */
  hideLogisticsMeetingAndReturn?: boolean;
}

/**
 * Location / destination picker + logistics meeting & return points.
 * Parent form must be wrapped in `FormProvider` and include `locationSection` + `tripDetails.logistics` keys.
 */
export function TourLocationSection({
  regions,
  destinations,
  hideRegionDestinationPickers = false,
  hideLogisticsMeetingAndReturn = false,
}: TourLocationSectionProps) {
  const { register, control, formState } = useFormContext<FieldValues>();
  const { errors } = formState;
  const err = errors as FieldErrors<FieldValues>;

  const regionId = useWatch({
    control,
    name: "locationSection.regionId",
  }) as string | undefined;

  const availableDestinations = useMemo(
    () => destinations.filter((d) => d.isActive && (!regionId || d.regionId === regionId)),
    [destinations, regionId],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>مکان و مقصد</CardTitle>
      </CardHeader>
      <CardBody>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {!hideRegionDestinationPickers ? (
            <>
              <FormField label="منطقه" required error={(err.locationSection as { regionId?: { message?: string } } | undefined)?.regionId?.message}>
                <Select
                  invalid={Boolean((err.locationSection as { regionId?: unknown } | undefined)?.regionId)}
                  {...register("locationSection.regionId")}
                >
                  <option value="">یک منطقه را انتخاب کنید</option>
                  {regions
                    .filter((r) => r.isActive)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </Select>
              </FormField>

              <FormField
                label="مقصد اصلی"
                required
                error={(err.locationSection as { mainDestinationId?: { message?: string } } | undefined)?.mainDestinationId?.message}
              >
                <Select
                  invalid={Boolean((err.locationSection as { mainDestinationId?: unknown } | undefined)?.mainDestinationId)}
                  {...register("locationSection.mainDestinationId")}
                >
                  <option value="">یک مقصد را انتخاب کنید</option>
                  {availableDestinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </>
          ) : null}

          <FormField
            label="نمایش دلخواه مکان"
            description="در صورت نیاز، متن دلخواه برای نمایش در کارت/جزئیات تور وارد کنید؛ در غیر این صورت، از مقصد اصلی و منطقه استفاده می‌شود."
            error={(err.locationSection as { displayLocationOverride?: { message?: string } } | undefined)?.displayLocationOverride?.message}
          >
            <Input autoComplete="off" {...register("locationSection.displayLocationOverride")} />
          </FormField>

          {!hideLogisticsMeetingAndReturn ? (
            <>
              <FormField
                label="محل قرار (meeting point)"
                error={(err.tripDetails as { logistics?: { meetingPoint?: { message?: string } } } | undefined)?.logistics?.meetingPoint?.message}
              >
                <Input autoComplete="off" {...register("tripDetails.logistics.meetingPoint")} />
              </FormField>

              <FormField
                label="محل بازگشت"
                error={(err.tripDetails as { logistics?: { returnPoint?: { message?: string } } } | undefined)?.logistics?.returnPoint?.message}
              >
                <Input autoComplete="off" {...register("tripDetails.logistics.returnPoint")} />
              </FormField>
            </>
          ) : null}

          {/* Placeholder for future multi-select secondary destinations */}
          <FormField
            label="مقصدهای ثانویه"
            description="در نسخه بعدی، این فیلد به‌صورت چندانتخابی پیاده‌سازی می‌شود."
          >
            <Textarea
              rows={2}
              placeholder="فعلاً می‌توانید توضیح متنی مقصدهای ثانویه را اینجا بنویسید."
              {...register("locationSection.secondaryDestinationIdsRaw")}
            />
          </FormField>
        </div>
      </CardBody>
    </Card>
  );
}
