/**
 * Guards against accidental runtime use of deprecated {@link denaliTourCreateBaseSchema}.
 */

import { DenaliLegacySchemaForbiddenError } from "./denaliLegacySchemaForbiddenError";

export type { DenaliLegacySchemaSite } from "./denaliLegacySchemaSite";
import type { DenaliLegacySchemaSite } from "./denaliLegacySchemaSite";

const ALLOWED_SITES = new Set<DenaliLegacySchemaSite>([]);

/**
 * Throws when legacy schema is used outside allowlisted sites (all environments).
 */
export function assertDenaliLegacySchemaAllowed(site: DenaliLegacySchemaSite): void {
  if (ALLOWED_SITES.has(site)) {
    return;
  }
  throw new DenaliLegacySchemaForbiddenError(site);
}
