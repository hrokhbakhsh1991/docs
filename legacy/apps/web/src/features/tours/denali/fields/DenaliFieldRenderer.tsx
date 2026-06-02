"use client";

import type { DenaliFieldRegistryEntry } from "@repo/denali-domain";

import { useDenaliFieldRules } from "../hooks/useDenaliFieldRules";
import {
  DENALI_ZOD_KIND_ALIASES,
  DENALI_ZOD_KIND_COMPONENTS,
} from "./denaliZodKindComponents";

export type DenaliFieldRendererProps = {
  field: DenaliFieldRegistryEntry;
};

/**
 * Registry-driven field shell — visibility from active rule model (not step-scoped).
 */
export function DenaliFieldRenderer({ field }: DenaliFieldRendererProps) {
  const { isVisible, isRequired } = useDenaliFieldRules();

  if (field.inRuleModel === false) {
    return null;
  }

  if (!isVisible(field.canonicalPath)) {
    return null;
  }

  const Component =
    DENALI_ZOD_KIND_ALIASES[field.canonicalPath] ??
    (field.zodKind ? DENALI_ZOD_KIND_COMPONENTS[field.zodKind] : undefined);

  if (Component == null) {
    return null;
  }

  const required = isRequired(field.canonicalPath);

  return (
    <div data-field-path={field.rhfPath} data-canonical-path={field.canonicalPath}>
      <Component field={field} required={required} />
    </div>
  );
}
