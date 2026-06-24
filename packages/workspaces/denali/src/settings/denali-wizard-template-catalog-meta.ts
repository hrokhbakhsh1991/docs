import { DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR } from "../composites/denali-composite-anchors";
import { DENALI_COMPOSITE_BY_CANONICAL_PATH } from "../composites/denali-composite-registry";
import { DENALI_FIELD_DEFINITIONS } from "../field-registry/denaliFieldRegistryData";
import type { DenaliFieldDefinition } from "../field-registry/denaliFieldRegistryData";
import { DENALI_MATRIX_REQUIRED_TEMPLATE_FIELDS } from "../wizard/ensure-tour-kind-template-field";

export type DenaliWizardTemplateCatalogFieldMeta = {
  readonly parentCanonicalPath: string | null;
  readonly compositeChildPaths: readonly string[];
  readonly matrixInjectedRequired: boolean;
  readonly registryDefaultRequired: boolean;
  readonly contextualWatchCanonical: string | null;
  readonly isCompositeAnchor: boolean;
};

export function findDenaliFieldDefinition(canonicalPath: string): DenaliFieldDefinition | undefined {
  return DENALI_FIELD_DEFINITIONS.find((def) => def.canonicalPath === canonicalPath);
}

export function resolveDenaliCompositeParentAnchor(canonicalPath: string): string | null {
  for (const [anchor, dependents] of Object.entries(DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR)) {
    if (dependents.includes(canonicalPath)) {
      return anchor;
    }
  }
  return null;
}

export function listDenaliCompositeDependentPaths(anchorPath: string): readonly string[] {
  return DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR[anchorPath] ?? [];
}

export function isDenaliMatrixInjectedRequired(stepId: string, canonicalPath: string): boolean {
  const fields = DENALI_MATRIX_REQUIRED_TEMPLATE_FIELDS[stepId] ?? [];
  return fields.some((field) => field.canonicalPath === canonicalPath && field.required === true);
}

/** Map contextual watch paths to catalog canonical paths for parent labels. */
export function normalizeDenaliTemplateWatchCanonicalPath(watchCanonical: string): string {
  const trimmed = watchCanonical.trim();
  if (trimmed === "basicInfo.tourType") {
    return "category";
  }
  return trimmed;
}

export function resolveDenaliTemplateFieldSiblingCompositeAnchor(
  canonicalPath: string,
  stepFieldPaths: readonly string[]
): string | null {
  if (resolveDenaliCompositeParentAnchor(canonicalPath) != null) {
    return null;
  }
  const dotIndex = canonicalPath.indexOf(".");
  if (dotIndex < 0) {
    return null;
  }
  const prefix = `${canonicalPath.slice(0, dotIndex)}.`;
  for (const path of stepFieldPaths) {
    if (path === canonicalPath) {
      continue;
    }
    const dependents = DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR[path];
    if (dependents?.some((dependent) => dependent.startsWith(prefix))) {
      return path;
    }
  }
  return null;
}

export function resolveDenaliCompositeRendererIdForAnchor(
  anchorCanonicalPath: string
): string | null {
  return DENALI_COMPOSITE_BY_CANONICAL_PATH[anchorCanonicalPath] ?? null;
}

export function resolveDenaliWizardTemplateCatalogFieldMeta(
  canonicalPath: string,
  stepId: string,
  stepFieldPaths: readonly string[]
): DenaliWizardTemplateCatalogFieldMeta {
  const def = findDenaliFieldDefinition(canonicalPath);
  const compositeChildPaths = listDenaliCompositeDependentPaths(canonicalPath);

  let parentCanonicalPath = resolveDenaliCompositeParentAnchor(canonicalPath);
  if (parentCanonicalPath == null) {
    parentCanonicalPath = resolveDenaliTemplateFieldSiblingCompositeAnchor(
      canonicalPath,
      stepFieldPaths
    );
  }

  const contextualWatchCanonical =
    def?.contextualVisibility?.kind === "whenTruthy"
      ? normalizeDenaliTemplateWatchCanonicalPath(def.contextualVisibility.watchCanonical)
      : null;

  if (parentCanonicalPath == null && contextualWatchCanonical != null) {
    parentCanonicalPath = contextualWatchCanonical;
  }

  return {
    parentCanonicalPath,
    compositeChildPaths,
    matrixInjectedRequired: isDenaliMatrixInjectedRequired(stepId, canonicalPath),
    registryDefaultRequired: def?.ruleDefaults.required === true,
    contextualWatchCanonical,
    isCompositeAnchor: compositeChildPaths.length > 0,
  };
}
