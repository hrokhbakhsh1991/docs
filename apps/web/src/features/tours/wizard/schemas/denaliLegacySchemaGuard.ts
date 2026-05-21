/**
 * Guards against accidental runtime use of deprecated {@link denaliTourCreateBaseSchema}.
 */

export type DenaliLegacySchemaSite =
  | "parseDenaliTourCreateForm"
  | "denaliTourCreateSchema.parse"
  | "denaliTourCreateSchema.safeParse"
  | "zodResolver"
  | "submit"
  | "mapper"
  | "wizard"
  | "validation-submit";

const ALLOWED_SITES = new Set<DenaliLegacySchemaSite>([]);

/**
 * Throws in development when legacy schema is used outside allowlisted sites.
 * Production and test (`NODE_ENV=test`) do not throw — tests keep using legacy parse.
 */
export function assertDenaliLegacySchemaAllowed(site: DenaliLegacySchemaSite): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  if (ALLOWED_SITES.has(site)) {
    return;
  }
  throw new Error(
    `[Denali] Legacy base schema used in forbidden context "${site}". ` +
      "Submit/resolver/wizard must use denaliCanonicalTourSchema via parseDenaliCanonicalFromWizardForm / denaliCanonicalWizardResolver.",
  );
}
