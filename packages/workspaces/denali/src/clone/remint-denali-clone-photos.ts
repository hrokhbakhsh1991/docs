import {
  buildDenaliTourPhotoObjectKey,
  buildDenaliWizardDraftPhotoObjectKey,
} from "../photos/tour-photo-object-key";

import type { WizardPhotoRemintPlanEntry } from "@app-tour/workspace-sdk";

export type DenaliClonePhotoRemintTarget =
  | { readonly kind: "wizard-draft"; readonly tenantId: string; readonly sessionId: string }
  | { readonly kind: "tour"; readonly tenantId: string; readonly tourId: string };

/** @deprecated Use WizardPhotoRemintPlanEntry from @app-tour/workspace-sdk */
export type DenaliPhotoRemintPlanEntry = WizardPhotoRemintPlanEntry;

function createPhotoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  throw new Error("DENALI_PHOTO_ID_UNAVAILABLE");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    const existing = current[part];
    if (existing == null || typeof existing !== "object" || Array.isArray(existing)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function readPhotoRows(
  data: Record<string, unknown>
): { readonly path: string; readonly rows: Record<string, unknown>[] } | null {
  const photosRoot = data.photos;
  if (Array.isArray(photosRoot)) {
    return { path: "photos", rows: photosRoot.filter(isRecord) };
  }
  if (isRecord(photosRoot)) {
    for (const key of ["photos", "items", "entries"] as const) {
      const nested = photosRoot[key];
      if (Array.isArray(nested)) {
        return { path: `photos.${key}`, rows: nested.filter(isRecord) };
      }
    }
  }

  const photosData = data.photosData;
  if (isRecord(photosData) && Array.isArray(photosData.photos)) {
    return { path: "photosData.photos", rows: photosData.photos.filter(isRecord) };
  }

  return null;
}

function resolveDestStorageKey(
  target: DenaliClonePhotoRemintTarget,
  newPhotoId: string
): string {
  if (target.kind === "wizard-draft") {
    return buildDenaliWizardDraftPhotoObjectKey({
      tenantId: target.tenantId,
      sessionId: target.sessionId,
      photoId: newPhotoId,
    });
  }
  return buildDenaliTourPhotoObjectKey({
    tenantId: target.tenantId,
    tourId: target.tourId,
    photoId: newPhotoId,
  });
}

/**
 * Assigns fresh photo ids and destination storage keys for clone flows (DEC-P11-011).
 * URL-only rows keep `url`; storage-backed rows emit a remint plan for MinIO copy.
 */
export function remintDenaliClonePhotosInCanonical(
  data: Record<string, unknown>,
  target: DenaliClonePhotoRemintTarget
): { readonly data: Record<string, unknown>; readonly plan: readonly DenaliPhotoRemintPlanEntry[] } {
  const located = readPhotoRows(data);
  if (located === null || located.rows.length === 0) {
    return { data, plan: [] };
  }

  const plan: DenaliPhotoRemintPlanEntry[] = [];
  const remintedRows = located.rows.map((row) => {
    const oldPhotoId = String(row.id ?? "").trim() || createPhotoId();
    const newPhotoId = createPhotoId();
    const next: Record<string, unknown> = { ...row, id: newPhotoId };

    const oldStorageKey = typeof row.storageKey === "string" ? row.storageKey.trim() : "";
    if (oldStorageKey.length > 0) {
      const destStorageKey = resolveDestStorageKey(target, newPhotoId);
      next.storageKey = destStorageKey;
      plan.push({
        sourceStorageKey: oldStorageKey,
        destStorageKey,
        oldPhotoId,
        newPhotoId,
        ...(typeof row.contentType === "string" ? { contentType: row.contentType } : {}),
      });
    }

    return next;
  });

  const cloned = structuredClone(data) as Record<string, unknown>;
  writePath(cloned, located.path, remintedRows);

  if (located.path.startsWith("photosData.")) {
    const wizardPhotos = readPhotoRows(cloned);
    if (wizardPhotos?.path === "photos") {
      writePath(cloned, "photos", wizardPhotos.rows);
    }
  }

  return { data: cloned, plan };
}
