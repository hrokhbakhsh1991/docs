/**
 * Denali wizard form entrypoint (RHF state shape + defaults).
 *
 * **Submit / resolver:** {@link ./denaliCanonicalTourSchema.ts} via
 * {@link ../denali/validation/denaliSubmitValidation.ts} and {@link ./denaliWizardCanonicalResolver.ts}.
 *
 * **Deprecated:** {@link ./denaliTourCreateBaseSchema.ts} — unit tests only.
 */

export type { DenaliCreateTourWizardForm } from "./denaliTourCreateFormModel";

export {
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
  normalizeDenaliWizardForm,
} from "./denaliTourCreateFormModel";

/** @deprecated Tests only — use {@link ../denali/validation/denaliWizardFormZod.ts}. */
export {
  denaliTourCreateSchema,
  denaliTourCreateSchemaRuleAware,
  parseDenaliTourCreateForm,
} from "../denali/validation/denaliWizardFormZod";
