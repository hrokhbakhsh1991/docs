/**
 * Denali draft load path: persisted `canonical` → validated {@link DenaliCanonicalTourModel}.
 *
 * Pair with {@link mapDenaliWizardToDraftPayload} (save). Both use
 * {@link ../schemas/denaliCanonicalTourSchema.unified} as the contract boundary.
 */

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { denaliCanonicalTourSchema } from "@/features/tours/wizard/schemas/denaliCanonicalTourSchema.unified";

/**
 * Reconstructs the canonical tour model from a draft envelope payload (post-parse).
 * JSON-normalized so load matches persisted wire shape (undefined keys omitted).
 */
export function mapDenaliDraftToCanonical(
  draftCanonical: DenaliCanonicalTourModel,
): DenaliCanonicalTourModel {
  const parsed = denaliCanonicalTourSchema.parse(draftCanonical);
  return JSON.parse(JSON.stringify(parsed)) as DenaliCanonicalTourModel;
}
