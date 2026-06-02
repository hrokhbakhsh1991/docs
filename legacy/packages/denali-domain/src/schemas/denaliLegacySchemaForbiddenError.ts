import type { DenaliLegacySchemaSite } from "./denaliLegacySchemaSite";

export class DenaliLegacySchemaForbiddenError extends Error {
  readonly name = "DenaliLegacySchemaForbiddenError";

  readonly site: DenaliLegacySchemaSite;

  constructor(site: DenaliLegacySchemaSite) {
    super(
      `[Denali] Legacy base schema used in forbidden context "${site}". ` +
        "Submit/resolver/wizard must use denaliCanonicalTourSchema via parseDenaliCanonicalFromWizardForm / denaliCanonicalWizardResolver.",
    );
    this.site = site;
  }
}
