import { TOUR_FORM_PROFILE_VALUES } from "@repo/types";
import { z } from "zod";

const tourMetadataStagingShellSchema = z
  .object({
    vertical: z.literal("staging_shell"),
    isStagingShell: z.literal(true),
  })
  .strict();

const tourMetadataProfileSchemas = TOUR_FORM_PROFILE_VALUES.map((profile) =>
  z
    .object({
      vertical: z.literal(profile),
      stageCount: z.number().int().min(0).optional(),
    })
    .strict(),
);

/** Tenant-scoped metadata bag — discriminated on vertical business domain token. */
export const tourMetadataWireSchema = z.discriminatedUnion("vertical", [
  tourMetadataStagingShellSchema,
  ...(tourMetadataProfileSchemas as [
    (typeof tourMetadataProfileSchemas)[0],
    ...(typeof tourMetadataProfileSchemas)[number][],
  ]),
]);

export type TourMetadataWire = z.infer<typeof tourMetadataWireSchema>;
