import type {
  WizardTemplateFieldRef,
  WizardTemplatePayloadV1,
  WizardTemplateStepRef,
} from "../settings/settings.types";

import {
  buildExposureFieldCatalog,
  type ExposureFieldCatalogEntry,
} from "./exposure-field-catalog";

export type WizardTemplateExposurePayload = Pick<
  WizardTemplatePayloadV1,
  "published" | "steps"
>;

function isEnabledWizardTemplateStep(step: WizardTemplateStepRef): boolean {
  return step.enabled !== false;
}

export function isWizardTemplatePublishedForExposure(
  payload: WizardTemplateExposurePayload,
): boolean {
  return payload.published === true;
}

export function resolveWizardTemplateAllowedCanonicalPaths(
  payload: WizardTemplateExposurePayload,
): readonly string[] {
  if (!isWizardTemplatePublishedForExposure(payload)) {
    return [];
  }

  const paths = new Set<string>();
  for (const step of payload.steps ?? []) {
    if (!isEnabledWizardTemplateStep(step)) {
      continue;
    }
    for (const field of step.fields) {
      if (isHiddenWizardTemplateField(field)) {
        continue;
      }
      const path = field.canonicalPath.trim();
      if (path.length > 0) {
        paths.add(path);
      }
    }
  }
  return [...paths];
}

function isHiddenWizardTemplateField(field: WizardTemplateFieldRef): boolean {
  return field.hidden === true;
}

function resolveRegistryEntryForTemplatePath(
  registryByCanonicalPath: ReadonlyMap<string, ExposureFieldCatalogEntry>,
  registryById: ReadonlyMap<string, ExposureFieldCatalogEntry>,
  canonicalPath: string,
): ExposureFieldCatalogEntry | null {
  const direct = registryByCanonicalPath.get(canonicalPath);
  if (direct != null) {
    return direct;
  }
  return registryById.get(canonicalPath) ?? null;
}

export function buildWizardTemplateExposureCatalog(input: {
  readonly workspaceType: string | null;
  readonly wizardTemplatePayload: WizardTemplateExposurePayload;
}): readonly ExposureFieldCatalogEntry[] {
  if (!isWizardTemplatePublishedForExposure(input.wizardTemplatePayload)) {
    return [];
  }

  const registryFields = buildExposureFieldCatalog(input.workspaceType);
  if (registryFields.length === 0) {
    return [];
  }

  const registryByCanonicalPath = new Map(
    registryFields.map((field) => [field.canonicalPath, field]),
  );
  const registryById = new Map(registryFields.map((field) => [field.id, field]));
  const seenFieldIds = new Set<string>();
  const catalog: ExposureFieldCatalogEntry[] = [];

  for (const step of input.wizardTemplatePayload.steps ?? []) {
    if (!isEnabledWizardTemplateStep(step)) {
      continue;
    }
    const stepLabel = step.label.trim();

    for (const field of step.fields) {
      if (isHiddenWizardTemplateField(field)) {
        continue;
      }
      const canonicalPath = field.canonicalPath.trim();
      if (canonicalPath.length === 0) {
        continue;
      }

      const registryEntry = resolveRegistryEntryForTemplatePath(
        registryByCanonicalPath,
        registryById,
        canonicalPath,
      );
      if (registryEntry == null || seenFieldIds.has(registryEntry.id)) {
        continue;
      }

      seenFieldIds.add(registryEntry.id);
      catalog.push(
        Object.freeze({
          ...registryEntry,
          ...(stepLabel.length > 0 ? { group: stepLabel } : {}),
        }),
      );
    }
  }

  return Object.freeze(catalog);
}
