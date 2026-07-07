/**
 * Compatibility re-exports — Phase 4 read boundary lives in `apps/api/src/exposure/`.
 *
 * @deprecated Import from `../../exposure/exposure-field-catalog` or
 * `../../exposure/resolve-registry-seeded-exposure-profile` in new code.
 */
import type { ExposureFieldCatalogEntry } from "../../exposure/exposure-field-catalog";
import {
  buildExposureFieldCatalog,
  buildExposureSelectableFieldCatalog,
} from "../../exposure/exposure-field-catalog";
import {
  resolveExposureProfileDefaultFieldIds,
  resolveExposureRequestedFieldIds,
  resolveDeliveryExposureProfileContext,
} from "../../exposure/resolve-registry-seeded-exposure-profile";

export type DeliveryFieldCatalogEntry = ExposureFieldCatalogEntry;

export const buildDeliveryFieldCatalog = buildExposureFieldCatalog;
export const buildDeliverySelectableFieldCatalog = buildExposureSelectableFieldCatalog;

export function getDefaultDeliveryFields(workspaceType: string | null): readonly string[] {
  return resolveExposureProfileDefaultFieldIds(workspaceType);
}

export function resolveRequestedDeliveryFieldIds(
  adminSelectedFieldIds: readonly string[] | null | undefined,
  workspaceType: string | null,
  eventType?: string,
): readonly string[] {
  return resolveExposureRequestedFieldIds(
    adminSelectedFieldIds,
    workspaceType,
    resolveDeliveryExposureProfileContext(eventType),
  );
}
