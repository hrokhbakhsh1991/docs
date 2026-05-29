import { DENALI_ROOTS } from "@repo/shared-contracts";

import { DENALI_FIELD_DEFINITIONS } from "../registry/denaliFieldRegistryData";
import {
  getDenaliFormPathValue,
  setDenaliFormPathValue,
} from "../adapters/denaliFormPathUtils";
import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";

function uniqueRegistryRhfPaths(): readonly string[] {
  return [...new Set(DENALI_FIELD_DEFINITIONS.map((field) => field.rhfPath))];
}

/**
 * Keeps only registry-addressable RHF paths under DENALI_ROOTS.
 * Prevents stale draft payload keys after registry field churn.
 */
export function pruneDenaliWizardFormToRegistry(
  source: DenaliCreateTourWizardForm,
): DenaliCreateTourWizardForm {
  const pruned = buildDenaliTourCreateDefaultValues();

  for (const path of uniqueRegistryRhfPaths()) {
    const value = getDenaliFormPathValue(source, path);
    if (value !== undefined) {
      setDenaliFormPathValue(pruned, path, value);
    }
  }

  const prunedRecord = pruned as unknown as Record<string, unknown>;
  for (const key of Object.keys(prunedRecord)) {
    if (!DENALI_ROOTS.includes(key as (typeof DENALI_ROOTS)[number])) {
      delete prunedRecord[key];
    }
  }

  return pruned;
}
