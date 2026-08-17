import { isDenaliCatalogSoftFail } from "../adapters/catalog-soft-fail";

/** Why an optional catalog picker shows empty-skip copy (ED-EMPTY-OPT-01). */
export type DenaliOptionalEmptyReason = "degraded" | "catalog_empty" | "operator_skip";

/**
 * Optional gear / guide-language empty is a skip, not a blocking error.
 * Loading and hard catalog errors are owned by other UI (spinner / alert).
 */
export function resolveDenaliOptionalEmptyReason(input: {
  readonly loading: boolean;
  readonly error: string | null;
  readonly catalogItemCount: number;
  readonly selectedCount: number;
}): DenaliOptionalEmptyReason | null {
  if (input.loading) {
    return null;
  }
  if (input.error != null) {
    return isDenaliCatalogSoftFail(input.error) ? "degraded" : null;
  }
  if (input.catalogItemCount === 0) {
    return "catalog_empty";
  }
  if (input.selectedCount === 0) {
    return "operator_skip";
  }
  return null;
}
