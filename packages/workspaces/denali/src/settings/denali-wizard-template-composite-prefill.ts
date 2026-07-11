import {
  DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR,
  DENALI_COMPOSITE_DEPENDENT_PATHS,
} from "../composites/denali-composite-anchors";
import type { DenaliZodFieldKind } from "../field-registry/denaliFieldRegistryData";
import { findDenaliFieldDefinition } from "./denali-wizard-template-catalog-meta";

const FITNESS_LEVEL_VALUES = ["low", "medium", "high"] as const;

function coerceByZodKind(zodKind: DenaliZodFieldKind, trimmed: string): unknown | null {
  switch (zodKind) {
    case "booleanOptional":
    case "adminCapacityApproval":
      if (trimmed === "true" || trimmed === "false") {
        return trimmed;
      }
      return null;
    case "fitnessLevel":
      return FITNESS_LEVEL_VALUES.includes(trimmed as (typeof FITNESS_LEVEL_VALUES)[number])
        ? trimmed
        : null;
    case "transportMode":
      if (
        ["organizer_vehicle", "bus", "minibus", "train", "shared_cars", "none"].includes(trimmed)
      ) {
        return trimmed;
      }
      return null;
    case "paymentMode":
      return trimmed === "offline_receipt" ? trimmed : null;
    case "optionalInt":
    case "optionalPositiveInt":
    case "capacityMax":
    case "difficultyLevel":
      return /^\d+$/.test(trimmed) ? trimmed : null;
    case "stringOptional":
    case "title":
    case "socialMediaLink":
    case "approximateReturnTime":
    case "destinationId":
      return trimmed;
    default:
      return trimmed.length > 0 ? trimmed : null;
  }
}

export function resolveDenaliCompositeAnchorForDependent(canonicalPath: string): string | null {
  for (const [anchor, dependents] of Object.entries(DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR)) {
    if (dependents.includes(canonicalPath)) {
      return anchor;
    }
  }
  return null;
}

export function listDenaliCompositeDependentPathsForAnchor(anchorPath: string): readonly string[] {
  return DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR[anchorPath] ?? [];
}

export function isDenaliTemplateCompositeDependentPath(canonicalPath: string): boolean {
  return DENALI_COMPOSITE_DEPENDENT_PATHS.has(canonicalPath);
}

export function isDenaliCompositeDependentAllowedInTemplateStep(
  stepFields: readonly { readonly canonicalPath: string; readonly hidden?: boolean }[],
  dependentPath: string
): boolean {
  if (!isDenaliTemplateCompositeDependentPath(dependentPath)) {
    return false;
  }
  const anchor = resolveDenaliCompositeAnchorForDependent(dependentPath);
  if (anchor == null) {
    return false;
  }
  return stepFields.some(
    (field) => field.canonicalPath.trim() === anchor && field.hidden !== true
  );
}

/** Coerce template default for Denali field definitions (incl. composite dependents). */
export function coerceDenaliWizardTemplateDefaultValue(
  canonicalPath: string,
  raw: string
): unknown | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const def = findDenaliFieldDefinition(canonicalPath);
  if (def?.zodKind != null) {
    return coerceByZodKind(def.zodKind, trimmed);
  }
  return trimmed;
}

export function isDenaliWizardTemplateDefaultValueCoercible(
  canonicalPath: string,
  raw: string
): boolean {
  return coerceDenaliWizardTemplateDefaultValue(canonicalPath, raw) != null;
}
