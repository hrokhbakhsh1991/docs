import { DENALI_ROOTS } from "@repo/shared-contracts";

import { DENALI_FIELD_DEFINITIONS } from "../registry/denaliFieldRegistryData";
import {
  getDenaliFormPathValue,
  setDenaliFormPathValue,
} from "../adapters/denaliFormPathUtils";
import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import {
  deepStripUnregisteredDenaliWizardKeys,
  deepStripUnregisteredDenaliWizardKeysAtPrefix,
  ZOD_KIND_ARRAY_ELEMENT_KEYS,
} from "./deepStripUnregisteredDenaliWizardKeys";

function uniqueRegistryRhfPaths(): readonly string[] {
  return [...new Set(DENALI_FIELD_DEFINITIONS.map((field) => field.rhfPath))];
}

const ARRAY_FIELD_RHF_PATHS = [
  ...new Set(
    DENALI_FIELD_DEFINITIONS.filter((field) => field.zodKind in ZOD_KIND_ARRAY_ELEMENT_KEYS).map(
      (field) => field.rhfPath,
    ),
  ),
];

/**
 * For registered array fields, deep-strip each element object (removes smuggled row keys).
 */
function deepStripRegisteredArrayElementInteriors(form: DenaliCreateTourWizardForm): void {
  for (const path of ARRAY_FIELD_RHF_PATHS) {
    const value = getDenaliFormPathValue(form, path);
    if (!Array.isArray(value) || value.length === 0) {
      continue;
    }
    const stripped = value.map((item) => {
      if (item === null || item === undefined) {
        return item;
      }
      if (typeof item === "object") {
        return deepStripUnregisteredDenaliWizardKeysAtPrefix(item, path);
      }
      return item;
    });
    setDenaliFormPathValue(form, path, stripped);
  }
}

/**
 * Keeps only registry-addressable RHF paths under DENALI_ROOTS.
 * Prevents stale draft payload keys after registry field churn.
 * Deep-strips nested keys that are not on any registry path segment whitelist.
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

  deepStripRegisteredArrayElementInteriors(pruned);

  const stripped = deepStripUnregisteredDenaliWizardKeys(pruned) as DenaliCreateTourWizardForm;

  const strippedRecord = stripped as unknown as Record<string, unknown>;
  for (const key of Object.keys(strippedRecord)) {
    if (!DENALI_ROOTS.includes(key as (typeof DENALI_ROOTS)[number])) {
      delete strippedRecord[key];
    }
  }

  return stripped;
}
