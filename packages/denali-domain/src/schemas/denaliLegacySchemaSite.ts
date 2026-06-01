/** Call sites where legacy {@link denaliTourCreateBaseSchema} must not run. */
export type DenaliLegacySchemaSite =
  | "parseDenaliTourCreateForm"
  | "denaliTourCreateSchema.parse"
  | "denaliTourCreateSchema.safeParse"
  | "zodResolver"
  | "submit"
  | "mapper"
  | "wizard"
  | "validation-submit";
