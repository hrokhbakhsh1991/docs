/**
 * Unified canonical submit authority for Denali create wizard.
 *
 * Strict Zod validation for {@link DenaliCanonicalTourModel} only — no legacy form fields.
 * Wired on submit via {@link ../denali/validation/denaliSubmitValidation.ts}.
 * Cross-field business rules: API {@link ../../../../api/src/modules/tours/utils/assert-create-tour-invariants.ts}.
 * Wizard required/visibility: {@link ../denali/rules/denaliRuleRequired.ts}.
 *
 * - **Registry form base:** {@link denaliTourCreateBaseSchema} (6-tab RHF shape from registry codegen).
 * - **Submit object base:** {@link denaliCanonicalTourObjectSchema} flat canonical shape.
 */

import {
  isDenaliTransportDongAmountRequired,
  type DenaliCanonicalTourModel,
} from "@repo/types/denali";
import { z } from "zod";

import { denaliTourCreateBaseSchema } from "./denaliTourCreateBaseSchema.generated";
import { denaliCanonicalTourObjectSchema } from "./denaliCanonicalTourSchema.base";

/** Registry-driven wizard form Zod (6-tab). Not merged into canonical submit schema (different shape). */
export { denaliTourCreateBaseSchema };

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Strict canonical tour schema — structural constraints + conditional numeric rules. */
export const denaliCanonicalTourSchema = denaliCanonicalTourObjectSchema.superRefine((data, ctx) => {
  if (data.duration === "multi") {
    const end = data.endDateTime?.trim();
    if (end == null || end === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDateTime"],
        message: "زمان پایان برای تور چندروزه الزامی است.",
      });
    }
  }

  const startMs = Date.parse(data.startDateTime.trim());
  const endRaw = data.endDateTime?.trim();
  if (endRaw != null && endRaw !== "" && !Number.isNaN(startMs)) {
    const endMs = Date.parse(endRaw);
    if (!Number.isNaN(endMs) && endMs <= startMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDateTime"],
        message: "زمان پایان باید بعد از زمان شروع باشد.",
      });
    }
  }

  if (data.capacityMax == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacityMax"],
      message: "حداکثر ظرفیت الزامی است.",
    });
  } else if (!isPositiveInt(data.capacityMax)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacityMax"],
      message: "حداکثر ظرفیت باید حداقل ۱ باشد.",
    });
  }

  if (data.capacityMax != null && data.capacityMin != null && data.capacityMin > data.capacityMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacityMin"],
      message: "حداقل ظرفیت نمی‌تواند بیشتر از حداکثر ظرفیت باشد.",
    });
  }

  if (
    isDenaliTransportDongAmountRequired({
      mode: data.transport.mode,
      allowPersonalCar: data.transport.allowPersonalCar,
    }) &&
    !isPositiveInt(data.transport.dongAmount)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["transport", "dongAmount"],
      message: "مبلغ دنگ برای خودرو شخصی الزامی است.",
    });
  }

  if (data.pricing.requiresPayment === true && !isPositiveInt(data.pricing.basePricePerPerson)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pricing", "basePricePerPerson"],
      message: "قیمت به ازای هر نفر برای تور پولی الزامی است.",
    });
  }

  if (data.category === "mountain") {
    if (!isPositiveInt(data.program.altitudeMeasurement)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["program", "altitudeMeasurement"],
        message: "حداکثر ارتفاع برای تور کوهنوردی الزامی است.",
      });
    }
    if (data.participants.sportsInsuranceRequired !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participants", "sportsInsuranceRequired"],
        message: "بیمه ورزشی برای تور کوهنوردی الزامی است.",
      });
    }
  }

  if (
    data.participants.minimumAge != null &&
    data.participants.maximumAge != null &&
    data.participants.minimumAge > data.participants.maximumAge
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["participants", "maximumAge"],
      message: "حداکثر سن نمی‌تواند کمتر از حداقل سن باشد.",
    });
  }

  if (data.duration === "multi") {
    const rows = data.program.itinerary ?? [];
    if (rows.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["program", "itinerary"],
        message: "برنامه روزانه برای تور چندروزه الزامی است.",
      });
    } else {
      for (let i = 0; i < rows.length; i += 1) {
        if (rows[i]!.activities.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["program", "itinerary", i, "activities"],
            message: "حداقل یک فعالیت برای هر روز الزامی است.",
          });
        }
      }
    }
  }
});

/** PascalCase alias for the canonical submit schema (registry cutover export). */
export const DenaliCanonicalTourSchema = denaliCanonicalTourSchema;

export type DenaliCanonicalTourSchema = z.infer<typeof denaliCanonicalTourSchema>;

export function parseDenaliCanonicalTour(input: unknown): DenaliCanonicalTourModel {
  return denaliCanonicalTourSchema.parse(input);
}

export function safeParseDenaliCanonicalTour(input: unknown) {
  return denaliCanonicalTourSchema.safeParse(input);
}
