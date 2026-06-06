import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { runValidationOffThread } from "../canonical/validation-worker-pool";
import type { CreateTourBody } from "./create-tour.schema";
import type { ValidateBeforePersistInput } from "./canonical-validation-sync";

export type { ValidateBeforePersistInput } from "./canonical-validation-sync";
export {
  getOrCreateValidationEngine,
  validateCanonicalBeforePersistSync,
  resetValidationEngineCacheForTests,
} from "./canonical-validation-sync";

/** Production path — offloads CPU-heavy RuleEngine to worker pool when enabled (DEC-056). */
export async function validateCanonicalBeforePersist(
  input: ValidateBeforePersistInput
): Promise<CanonicalDocument> {
  return runValidationOffThread(input);
}

export async function buildValidatedCanonicalDocument(
  body: CreateTourBody,
  tenantId: string,
  workspaceType = "starter"
): Promise<CanonicalDocument> {
  return validateCanonicalBeforePersist({ body, tenantId, workspaceType });
}
