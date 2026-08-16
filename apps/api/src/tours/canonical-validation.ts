import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { resolveCatalogRefAllowlistsForWorkspace } from "../canonical/resolve-catalog-ref-allowlists-dispatch.ts";
import { isWorkspaceMetadataEnabled } from "../workspace-metadata/is-workspace-metadata-enabled.ts";
import { runValidationOffThread } from "../canonical/validation-worker-pool";
import type { CreateTourBody } from "./create-tour.schema";
import type { ValidateBeforePersistInput } from "./canonical-validation-sync.types";
import {
  validateCanonicalBeforePersistAsync,
} from "./canonical-validation-sync";
import { applyWorkspacePersistCanonicalNormalize } from "./apply-workspace-persist-canonical-normalize";

async function enrichValidateBeforePersistInput(
  input: ValidateBeforePersistInput
): Promise<ValidateBeforePersistInput> {
  let next = input;
  if (input.catalogRefAllowlists === undefined) {
    const catalogRefAllowlists = await resolveCatalogRefAllowlistsForWorkspace(
      input.workspaceType,
      input.tenantId
    );
    if (catalogRefAllowlists !== undefined) {
      next = {
        ...next,
        catalogRefAllowlists,
      };
    }
  }
  return applyWorkspacePersistCanonicalNormalize(next);
}

export type { ValidateBeforePersistInput } from "./canonical-validation-sync.types";
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
