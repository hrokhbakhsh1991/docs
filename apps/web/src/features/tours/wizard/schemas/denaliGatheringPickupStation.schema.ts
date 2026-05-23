import { z } from "zod";

import { denaliLocationDataSchema } from "./denaliLocationDataSchema";

const optionalTimeHhmm = z
  .string()
  .max(5)
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()))
  .refine((v) => v === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), {
    message: "فرمت زمان نامعتبر است. نمونه: ۱۴:۳۰",
  });

/** Nested gathering station row for wizard + tripDetails forms. */
export const denaliGatheringPickupStationFormSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().default(""),
    time: optionalTimeHhmm.optional(),
    location: denaliLocationDataSchema,
  })
  .strip();

export type DenaliGatheringPickupStationFormValue = z.infer<typeof denaliGatheringPickupStationFormSchema>;
