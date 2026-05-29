import { DENALI_ROOTS } from "@repo/shared-contracts";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  getDenaliFormPathValue,
  setDenaliFormPathValue,
} from "@/features/tours/wizard/denali/denaliFormPathUtils";
import { DENALI_FIELD_DEFINITIONS } from "@/features/tours/wizard/denali/registry/denaliFieldRegistryData";

function uniqueRegistryRhfPaths(): readonly string[] {
  return [...new Set(DENALI_FIELD_DEFINITIONS.map((field) => field.rhfPath))];
}

/**
 * Keeps only registry-addressable RHF paths under DENALI_ROOTS.
 * This prevents stale draft payload keys after registry field churn.
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
