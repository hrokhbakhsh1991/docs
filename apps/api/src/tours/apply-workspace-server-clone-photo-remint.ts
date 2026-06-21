import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { TourRecord } from "../db/tour-record";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import type { ToursService } from "./tours.service";
import { resolveWizardCloneRemintBinding } from "./workspace-wizard-clone-remint-dispatch";

/** Post-create MinIO copy + canonical patch for server tour clone (DEC-P11-011). */
export async function applyWorkspaceServerClonePhotoRemint(
  toursService: ToursService,
  auth: TenantAuthContext,
  record: TourRecord
): Promise<TourRecord> {
  const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
  const binding = resolveWizardCloneRemintBinding(workspaceType);
  if (
    binding === undefined ||
    !("remintCanonicalInTour" in binding) ||
    !("executeTourRemint" in binding) ||
    binding.remintCanonicalInTour == null ||
    binding.executeTourRemint == null
  ) {
    return record;
  }

  const minioConfig = binding.readConfigFromEnv();
  if (minioConfig === null) {
    return record;
  }

  const canonicalData = record.canonical.data as Record<string, unknown>;
  const reminted = binding.remintCanonicalInTour(canonicalData, {
    kind: "tour",
    tenantId: auth.tenantId,
    tourId: record.id,
  });
  if (reminted.plan.length === 0) {
    return record;
  }

  await binding.executeTourRemint({
    config: minioConfig,
    tenantId: auth.tenantId,
    plan: reminted.plan,
  });

  return toursService.updateTour(auth, record.id, {
    rowVersion: record.rowVersion,
    data: reminted.data,
  });
}
