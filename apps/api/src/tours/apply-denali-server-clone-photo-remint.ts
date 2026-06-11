import {
  executeDenaliTourPhotoRemintPlan,
  readMinioPhotoConfigFromEnv,
  remintDenaliClonePhotosInCanonical,
} from "@app-tour/workspace-denali";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { TourRecord } from "../db/tour-record";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import type { ToursService } from "./tours.service";

/** Post-create MinIO copy + canonical patch for server tour clone (DEC-P11-011). */
export async function applyDenaliServerClonePhotoRemint(
  toursService: ToursService,
  auth: TenantAuthContext,
  record: TourRecord
): Promise<TourRecord> {
  const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
  if (workspaceType !== "denali") {
    return record;
  }

  const minioConfig = readMinioPhotoConfigFromEnv();
  if (minioConfig === null) {
    return record;
  }

  const canonicalData = record.canonical.data as Record<string, unknown>;
  const reminted = remintDenaliClonePhotosInCanonical(canonicalData, {
    kind: "tour",
    tenantId: auth.tenantId,
    tourId: record.id,
  });
  if (reminted.plan.length === 0) {
    return record;
  }

  await executeDenaliTourPhotoRemintPlan({
    config: minioConfig,
    tenantId: auth.tenantId,
    plan: reminted.plan,
  });

  return toursService.updateTour(auth, record.id, {
    rowVersion: record.rowVersion,
    data: reminted.data,
  });
}
