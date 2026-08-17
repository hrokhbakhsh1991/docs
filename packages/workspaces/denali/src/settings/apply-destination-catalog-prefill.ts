import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../draft/denali-tour-wizard-draft";
import { isDenaliWizardFieldVisibleOnDraft } from "../wizard/denali-wizard-field-visibility";
import type { DestinationResource } from "../ui/adapters/catalog-types";
import {
  DENALI_DESTINATION_CATALOG_METRIC_BINDINGS,
  type DenaliDestinationCatalogMetricCanonicalPath,
} from "./destination-catalog-metric-bindings";
import {
  DENALI_DESTINATION_LOCATION_TYPE_NATURE_TRAIL,
  DENALI_DESTINATION_LOCATION_TYPE_PEAK,
  normalizeDenaliDestinationLocationType,
} from "./destination-location-types";
import {
  formatDestinationCatalogMetricValue,
  isDestinationCatalogMetricLocked,
  readLockedDestinationCatalogMetricValue,
} from "./resolve-destination-catalog-metric-lock";

function clearDestinationCatalogMetric(
  draft: DenaliTourWizardDraft,
  canonicalPath: DenaliDestinationCatalogMetricCanonicalPath
): DenaliTourWizardDraft {
  return setCanonicalStringValue(draft, canonicalPath, "");
}

function applyCatalogMetricForBinding(
  draft: DenaliTourWizardDraft,
  destination: DestinationResource,
  canonicalPath: DenaliDestinationCatalogMetricCanonicalPath
): DenaliTourWizardDraft {
  if (!isDenaliWizardFieldVisibleOnDraft(draft, canonicalPath, "denali_basic")) {
    return clearDestinationCatalogMetric(draft, canonicalPath);
  }

  const binding = DENALI_DESTINATION_CATALOG_METRIC_BINDINGS[canonicalPath];
  const catalogValue = destination[binding.catalogField];
  if (typeof catalogValue !== "number" || !Number.isFinite(catalogValue) || catalogValue <= 0) {
    return clearDestinationCatalogMetric(draft, canonicalPath);
  }
  return setCanonicalStringValue(
    draft,
    canonicalPath,
    formatDestinationCatalogMetricValue(catalogValue, binding)
  );
}

export function applyDestinationCatalogPrefill(
  draft: DenaliTourWizardDraft,
  destination: DestinationResource | undefined
): DenaliTourWizardDraft {
  if (destination === undefined) {
    let next = draft;
    for (const binding of Object.values(DENALI_DESTINATION_CATALOG_METRIC_BINDINGS)) {
      next = clearDestinationCatalogMetric(next, binding.canonicalPath);
    }
    return next;
  }

  const locationType = normalizeDenaliDestinationLocationType(destination.locationType);
  let next = draft;

  if (locationType === DENALI_DESTINATION_LOCATION_TYPE_PEAK) {
    next = clearDestinationCatalogMetric(next, "tripDetails.overview.trailDistanceKm");
    next = applyCatalogMetricForBinding(next, destination, "tripDetails.overview.peakHeight");
    return next;
  }

  if (locationType === DENALI_DESTINATION_LOCATION_TYPE_NATURE_TRAIL) {
    next = clearDestinationCatalogMetric(next, "tripDetails.overview.peakHeight");
    next = applyCatalogMetricForBinding(next, destination, "tripDetails.overview.trailDistanceKm");
    return next;
  }

  next = clearDestinationCatalogMetric(next, "tripDetails.overview.peakHeight");
  next = clearDestinationCatalogMetric(next, "tripDetails.overview.trailDistanceKm");
  return next;
}

/**
 * ED-CAT-SEED-01 — after sanitize hides then shows a catalog metric, fill canonical only when
 * the field is visible, empty, and the current destination locks that metric.
 * Does not overwrite operator-entered values and does not clear unlocked metrics
 * (unlike {@link applyDestinationCatalogPrefill}, which is dest-change only).
 */
export function seedEmptyVisibleDestinationCatalogMetrics(
  draft: DenaliTourWizardDraft,
  destination: DestinationResource | undefined
): DenaliTourWizardDraft {
  if (destination === undefined) {
    return draft;
  }

  let next = draft;
  for (const binding of Object.values(DENALI_DESTINATION_CATALOG_METRIC_BINDINGS)) {
    if (!isDenaliWizardFieldVisibleOnDraft(next, binding.canonicalPath, "denali_basic")) {
      continue;
    }
    if (getCanonicalStringValue(next, binding.canonicalPath).trim().length > 0) {
      continue;
    }
    if (!isDestinationCatalogMetricLocked(destination, binding)) {
      continue;
    }
    const catalogValue = readLockedDestinationCatalogMetricValue(destination, binding);
    if (catalogValue.trim().length === 0) {
      continue;
    }
    next = setCanonicalStringValue(next, binding.canonicalPath, catalogValue);
  }
  return next;
}
