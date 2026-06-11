import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../rules/generated/denaliCanonicalPathMap.generated";

import {
  remintDenaliClonePhotosInCanonical,
  type DenaliPhotoRemintPlanEntry,
} from "./remint-denali-clone-photos";

export const DENALI_CLONE_TITLE_SUFFIX = " (Copy)" as const;

export type DenaliTourCloneHydrationOptions = {
  readonly activeEquipmentIds?: readonly string[];
  readonly wizardSessionId?: string;
  readonly tenantId?: string;
};

export type DenaliTourCloneDraft = {
  readonly data: Record<string, unknown>;
  readonly photoRemintPlan?: readonly DenaliPhotoRemintPlanEntry[];
};

function readPath(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
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

function readTourTitle(source: Record<string, unknown>): string {
  for (const path of ["title", "basicInfo.title", "basics.title"]) {
    const value = readPath(source, path);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

export function appendDenaliCloneTitleSuffix(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return "Untitled tour (Copy)";
  }
  if (trimmed.endsWith(DENALI_CLONE_TITLE_SUFFIX)) {
    return trimmed;
  }
  return `${trimmed}${DENALI_CLONE_TITLE_SUFFIX}`;
}

function applyCopyTitle(target: Record<string, unknown>, sourceTitle: string): void {
  const nextTitle = appendDenaliCloneTitleSuffix(sourceTitle);
  writePath(target, "title", nextTitle);
  if (readPath(target, "basics") !== undefined) {
    writePath(target, "basics.title", nextTitle);
  }
  if (readPath(target, "basicInfo") !== undefined) {
    writePath(target, "basicInfo.title", nextTitle);
  }
}

function flattenLegacyFormToWizardData(source: Record<string, unknown>): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  for (const [canonicalPath, formPath] of Object.entries(DENALI_CANONICAL_TO_FORM_PATH_MAP)) {
    const value = readPath(source, formPath);
    if (value !== undefined) {
      writePath(target, canonicalPath, structuredClone(value));
    }
  }

  const tripDetails = source.tripDetails;
  if (tripDetails != null && typeof tripDetails === "object" && !Array.isArray(tripDetails)) {
    writePath(target, "tripDetails", structuredClone(tripDetails));
  }

  const photosData = source.photosData;
  if (photosData != null && typeof photosData === "object" && !Array.isArray(photosData)) {
    const photos = readPath(photosData as Record<string, unknown>, "photos");
    if (photos !== undefined) {
      writePath(target, "photos", structuredClone(photos));
    }
  }

  return target;
}

function normalizeCanonicalToWizardData(source: Record<string, unknown>): Record<string, unknown> {
  if ("basicInfo" in source) {
    return flattenLegacyFormToWizardData(source);
  }

  const cloned = structuredClone(source) as Record<string, unknown>;
  const flatTitle = readPath(cloned, "title");
  const basicsTitle = readPath(cloned, "basics.title");
  if (
    (flatTitle === undefined || (typeof flatTitle === "string" && flatTitle.trim().length === 0)) &&
    typeof basicsTitle === "string" &&
    basicsTitle.trim().length > 0
  ) {
    writePath(cloned, "title", basicsTitle.trim());
  }

  const programShort = readPath(cloned, "program.shortDescription");
  const detailsSummary = readPath(cloned, "details.summary");
  if (
    (programShort === undefined ||
      (typeof programShort === "string" && programShort.trim().length === 0)) &&
    typeof detailsSummary === "string" &&
    detailsSummary.trim().length > 0
  ) {
    writePath(cloned, "program.shortDescription", detailsSummary.trim());
  }

  return cloned;
}

/** Drops gear rows whose equipment id is not in the workspace active catalog. */
export function filterGearItemsToActiveEquipmentCatalog(
  gearItems: unknown,
  activeEquipmentIds: readonly string[] | undefined
): unknown {
  if (!Array.isArray(gearItems) || gearItems.length === 0) {
    return gearItems;
  }
  if (activeEquipmentIds === undefined) {
    return gearItems;
  }

  const allowed = new Set(
    activeEquipmentIds.map((id) => id.trim()).filter((id) => id.length > 0)
  );
  return gearItems.filter((row) => {
    if (row == null || typeof row !== "object") {
      return false;
    }
    const record = row as Record<string, unknown>;
    const equipmentId = String(record.equipmentId ?? record.id ?? "").trim();
    return equipmentId.length > 0 && allowed.has(equipmentId);
  });
}

function applyGearCatalogFilter(
  data: Record<string, unknown>,
  activeEquipmentIds: readonly string[] | undefined
): void {
  for (const path of ["participants.gearItems", "participantRequirements.gearItems"]) {
    const gearItems = readPath(data, path);
    const filtered = filterGearItemsToActiveEquipmentCatalog(gearItems, activeEquipmentIds);
    if (filtered !== gearItems) {
      writePath(data, path, filtered);
    }
  }
}

function maybeRemintWizardClonePhotos(
  data: Record<string, unknown>,
  options?: DenaliTourCloneHydrationOptions
): DenaliTourCloneDraft {
  const sessionId = options?.wizardSessionId?.trim() ?? "";
  const tenantId = options?.tenantId?.trim() ?? "";
  if (sessionId.length === 0 || tenantId.length === 0) {
    return { data };
  }
  const reminted = remintDenaliClonePhotosInCanonical(data, {
    kind: "wizard-draft",
    tenantId,
    sessionId,
  });
  return {
    data: reminted.data,
    ...(reminted.plan.length > 0 ? { photoRemintPlan: reminted.plan } : {}),
  };
}

/**
 * Maps stored tour canonical `data` into a new wizard draft for duplicate flow.
 */
export function denaliHydrateTourCloneDraft(
  canonicalData: Record<string, unknown>,
  options?: DenaliTourCloneHydrationOptions
): DenaliTourCloneDraft {
  const data = normalizeCanonicalToWizardData(canonicalData);
  applyCopyTitle(data, readTourTitle(canonicalData));
  writePath(data, "publishStatus", "draft");
  applyGearCatalogFilter(data, options?.activeEquipmentIds);
  return maybeRemintWizardClonePhotos(data, options);
}

/**
 * Server clone — mutate stored canonical `data` in place (no wizard-path flattening).
 * Used by `POST /tours/{id}/clone` before `createTour` validation (DEC-P11-010).
 */
export function prepareDenaliServerCloneCanonical(
  canonicalData: Record<string, unknown>,
  options?: DenaliTourCloneHydrationOptions
): Record<string, unknown> {
  const data = structuredClone(canonicalData) as Record<string, unknown>;
  applyCopyTitle(data, readTourTitle(canonicalData));
  writePath(data, "publishStatus", "draft");
  const basicInfo = readPath(data, "basicInfo");
  if (basicInfo != null && typeof basicInfo === "object" && !Array.isArray(basicInfo)) {
    writePath(data, "basicInfo.publishStatus", "draft");
  }
  applyGearCatalogFilter(data, options?.activeEquipmentIds);
  return data;
}
