export function buildDenaliTourPhotoObjectKey(input: {
  tenantId: string;
  tourId: string;
  photoId: string;
}): string {
  const tenantId = input.tenantId.trim();
  const tourId = input.tourId.trim();
  const photoId = input.photoId.trim();
  if (!tenantId || !tourId || !photoId) {
    throw new Error("DENALI_PHOTO_KEY_INVALID: tenantId, tourId, and photoId are required");
  }
  return `${tenantId}/tours/${tourId}/photos/${photoId}`;
}

/** Wizard create flow — provisional objects until tour id exists (Phase 6.7 / 9). */
export function buildDenaliWizardDraftPhotoObjectKey(input: {
  tenantId: string;
  sessionId: string;
  photoId: string;
}): string {
  const tenantId = input.tenantId.trim();
  const sessionId = input.sessionId.trim();
  const photoId = input.photoId.trim();
  if (!tenantId || !sessionId || !photoId) {
    throw new Error(
      "DENALI_PHOTO_KEY_INVALID: tenantId, sessionId, and photoId are required for wizard draft photos"
    );
  }
  return `${tenantId}/wizard-drafts/${sessionId}/photos/${photoId}`;
}

export function assertDenaliTourPhotoKeyTenantScope(key: string, tenantId: string): void {
  const normalizedTenant = tenantId.trim();
  const prefix = `${normalizedTenant}/`;
  if (!key.startsWith(prefix)) {
    throw new Error(
      `DENALI_PHOTO_TENANT_MISMATCH: key=${key} does not belong to tenant_id=${normalizedTenant}`
    );
  }
}
