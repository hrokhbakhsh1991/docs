import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { isWorkspaceMetadataEnabled } from "../workspace-metadata/is-workspace-metadata-enabled.ts";
import { runValidationOffThread } from "../canonical/validation-worker-pool";
import type { CreateTourBody } from "./create-tour.schema";
import type { ValidateBeforePersistInput } from "./canonical-validation-sync";
import { validateCanonicalBeforePersistAsync } from "./canonical-validation-sync";

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
  if (isWorkspaceMetadataEnabled()) {
    return validateCanonicalBeforePersistAsync(input);
  }
  return runValidationOffThread(input);
}

export async function buildValidatedCanonicalDocument(
  body: CreateTourBody,
  tenantId: string,
  workspaceType = "starter"
): Promise<CanonicalDocument> {
  return validateCanonicalBeforePersist({ body, tenantId, workspaceType });
}
