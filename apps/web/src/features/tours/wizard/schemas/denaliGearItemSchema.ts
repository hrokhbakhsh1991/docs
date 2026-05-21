import { z } from "zod";

/** Workspace equipment row in wizard + canonical submit (`gearRequiredIds` / `gearOptionalIds`). */
export const denaliGearItemSchema = z
  .object({
    id: z.string().trim().min(1),
    isRequired: z.boolean(),
  })
  .strict();

export type DenaliGearItem = z.infer<typeof denaliGearItemSchema>;
