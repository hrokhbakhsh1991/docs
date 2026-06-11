import type { DenaliPhotoRemintPlanEntry } from "../clone/remint-denali-clone-photos";
import { copyDenaliMinioPhotoObject } from "./minio-photo-storage";
import type { MinioPhotoConfig } from "./minio-photo-storage";
import { assertDenaliTourPhotoKeyTenantScope } from "./tour-photo-object-key";

export function assertDenaliWizardDraftDestKey(tenantId: string, destStorageKey: string): void {
  const prefix = `${tenantId.trim()}/wizard-drafts/`;
  if (!destStorageKey.startsWith(prefix)) {
    throw new Error("DENALI_PHOTO_REMINT_DEST_FORBIDDEN");
  }
}

/** Copies MinIO objects for a wizard-clone remint plan (DEC-P11-011). */
export async function executeDenaliWizardPhotoRemintPlan(input: {
  readonly config: MinioPhotoConfig;
  readonly tenantId: string;
  readonly plan: readonly DenaliPhotoRemintPlanEntry[];
}): Promise<void> {
  for (const entry of input.plan) {
    assertDenaliTourPhotoKeyTenantScope(entry.sourceStorageKey, input.tenantId);
    assertDenaliWizardDraftDestKey(input.tenantId, entry.destStorageKey);
    await copyDenaliMinioPhotoObject({
      config: input.config,
      tenantId: input.tenantId,
      sourceKey: entry.sourceStorageKey,
      destKey: entry.destStorageKey,
    });
  }
}

/** Copies MinIO objects for server tour clone remint (tour → tour keys). */
export async function executeDenaliTourPhotoRemintPlan(input: {
  readonly config: MinioPhotoConfig;
  readonly tenantId: string;
  readonly plan: readonly DenaliPhotoRemintPlanEntry[];
}): Promise<void> {
  const tourPrefix = `${input.tenantId.trim()}/tours/`;
  for (const entry of input.plan) {
    assertDenaliTourPhotoKeyTenantScope(entry.sourceStorageKey, input.tenantId);
    assertDenaliTourPhotoKeyTenantScope(entry.destStorageKey, input.tenantId);
    if (!entry.destStorageKey.startsWith(tourPrefix)) {
      throw new Error("DENALI_PHOTO_REMINT_DEST_FORBIDDEN");
    }
    await copyDenaliMinioPhotoObject({
      config: input.config,
      tenantId: input.tenantId,
      sourceKey: entry.sourceStorageKey,
      destKey: entry.destStorageKey,
    });
  }
}
