import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { isWorkspaceMetadataEnabled } from "../workspace-metadata/is-workspace-metadata-enabled.ts";
import { runValidationOffThread } from "../canonical/validation-worker-pool";
import type { CreateTourBody } from "./create-tour.schema";
import type { ValidateBeforePersistInput } from "./canonical-validation-sync";
import {
  validateCanonicalBeforePersistAsync,
  validateCanonicalBeforePersistSync,
} from "./canonical-validation-sync";
import { resolveDenaliCatalogRefAllowlists } from "../canonical/resolve-denali-catalog-ref-allowlists.ts";

async function enrichValidateBeforePersistInput(
  input: ValidateBeforePersistInput
): Promise<ValidateBeforePersistInput> {
  if (input.workspaceType !== "denali" || input.catalogRefAllowlists !== undefined) {
    return input;
  }
  return {
    ...input,
    catalogRefAllowlists: await resolveDenaliCatalogRefAllowlists(input.tenantId),
  };
}

export type { ValidateBeforePersistInput } from "./canonical-validation-sync";
export {
  buildValidationEngineCacheKey,
  getOrCreateValidationEngine,
  getOrCreateValidationEngineAsync,
  invalidateValidationEngineCacheForTenant,
  resolveMetadataFingerprintForEngineCache,
  validateCanonicalBeforePersistAsync,
  validateCanonicalBeforePersistSync,
  resetValidationEngineCacheForTests,
} from "./canonical-validation-sync";

/** Production path — offloads CPU-heavy RuleEngine to worker pool when enabled (DEC-056). */
export async function validateCanonicalBeforePersist(
  input: ValidateBeforePersistInput
): Promise<CanonicalDocument> {
  const enriched = await enrichValidateBeforePersistInput(input);
  if (isWorkspaceMetadataEnabled()) {
    return validateCanonicalBeforePersistAsync(enriched);
  }
  return runValidationOffThread(enriched);
}

export async function buildValidatedCanonicalDocument(
  body: CreateTourBody,
  tenantId: string,
  workspaceType = "starter"
): Promise<CanonicalDocument> {
  return validateCanonicalBeforePersist({ body, tenantId, workspaceType });
}
