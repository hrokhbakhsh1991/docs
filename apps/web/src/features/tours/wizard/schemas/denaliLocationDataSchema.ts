import { z } from "zod";

const LAT_RANGE = { min: -90, max: 90 } as const;
const LNG_RANGE = { min: -180, max: 180 } as const;

export const denaliLocationDataSchema = z
  .object({
    addressText: z.string().trim().default(""),
    latitude: z
      .union([z.number(), z.null(), z.undefined()])
      .transform((v) => (v === undefined ? null : v)),
    longitude: z
      .union([z.number(), z.null(), z.undefined()])
      .transform((v) => (v === undefined ? null : v)),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasLat = data.latitude != null;
    const hasLng = data.longitude != null;
    if (hasLat !== hasLng) {
      const message = "عرض و طول جغرافیایی باید هر دو وارد شوند یا هر دو خالی باشند.";
      if (!hasLat) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["latitude"] });
      }
      if (!hasLng) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["longitude"] });
      }
      return;
    }
    if (data.latitude != null && (data.latitude < LAT_RANGE.min || data.latitude > LAT_RANGE.max)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "عرض جغرافیایی باید بین ۹۰- تا ۹۰+ باشد.",
        path: ["latitude"],
      });
    }
    if (data.longitude != null && (data.longitude < LNG_RANGE.min || data.longitude > LNG_RANGE.max)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "طول جغرافیایی باید بین ۱۸۰- تا ۱۸۰+ باشد.",
        path: ["longitude"],
      });
    }
  });

export type DenaliLocationDataForm = z.infer<typeof denaliLocationDataSchema>;
