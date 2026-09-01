import {
  getCanonicalValueFromDraft,
  setCanonicalValueOnDraft,
  type CanonicalWizardDraftEnvelope,
} from "./canonical-draft-access";
import {
  parseDenaliItineraryDays,
  pruneItinerarySegmentDestinationIds,
  pruneItinerarySegmentPhotoIds,
} from "../schemas/denaliItineraryDaySchema";
import { parseDenaliTourPhotos } from "../ui/logic/denali-photo-types";

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return [];
}

export function filterIdsToAllowedCatalog(
  selected: unknown,
  allowedIds: readonly string[] | undefined
): string[] {
  if (allowedIds === undefined) {
    return parseStringArray(selected);
  }
  const allowed = new Set(allowedIds);
  return parseStringArray(selected).filter((id) => allowed.has(id));
}

export function sanitizeLeaderUserIdsOnDraft(
  draft: CanonicalWizardDraftEnvelope,
  selectableLeaderIds: readonly string[] | undefined
): CanonicalWizardDraftEnvelope {
  const filtered = filterIdsToAllowedCatalog(
    getCanonicalValueFromDraft(draft, "leaderUserIds"),
    selectableLeaderIds
  );
  return setCanonicalValueOnDraft(draft, "leaderUserIds", filtered);
}

export function sanitizeThemeIdsOnDraft(
  draft: CanonicalWizardDraftEnvelope,
  activeThemeIds: readonly string[] | undefined
): CanonicalWizardDraftEnvelope {
  const filtered = filterIdsToAllowedCatalog(
    getCanonicalValueFromDraft(draft, "program.themeIds"),
    activeThemeIds
  );
  return setCanonicalValueOnDraft(draft, "program.themeIds", filtered);
}

export function sanitizeGuideLanguageIdsOnDraft(
  draft: CanonicalWizardDraftEnvelope,
  activeGuideLanguageIds: readonly string[] | undefined
): CanonicalWizardDraftEnvelope {
  const filtered = filterIdsToAllowedCatalog(
    getCanonicalValueFromDraft(draft, "program.guideLanguageIds"),
    activeGuideLanguageIds
  );
  return setCanonicalValueOnDraft(draft, "program.guideLanguageIds", filtered);
}

export function sanitizeGearCatalogRefsOnDraft(
  draft: CanonicalWizardDraftEnvelope,
  activeEquipmentIds: readonly string[] | undefined,
  filterGearItems: (
    items: unknown,
    allowedIds: readonly string[] | undefined
  ) => unknown
): CanonicalWizardDraftEnvelope {
  if (activeEquipmentIds === undefined) {
    return draft;
  }
  const raw = getCanonicalValueFromDraft(draft, "participants.gearItems");
  if (!Array.isArray(raw)) {
    return draft;
  }
  const filtered = filterGearItems(raw, activeEquipmentIds);
  return setCanonicalValueOnDraft(draft, "participants.gearItems", filtered);
}

function collectAllowedPhotoIds(photosValue: unknown): ReadonlySet<string> {
  const ids = new Set<string>();
  if (!Array.isArray(photosValue)) {
    return ids;
  }
  for (const entry of photosValue) {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const id = (entry as Record<string, unknown>).id;
    if (typeof id === "string" && id.trim().length > 0) {
      ids.add(id.trim());
    }
  }
  return ids;
}

function isPersistableDenaliTourPhoto(photo: {
  readonly storageKey?: string;
  readonly url?: string;
}): boolean {
  const storageKey = photo.storageKey?.trim() ?? "";
  const url = photo.url?.trim() ?? "";
  return storageKey.length > 0 || url.length > 0;
}

/** Drop empty photo slots (no storageKey/url) before submit persistence. */
export function sanitizeCompleteTourPhotosOnDraft(
  draft: CanonicalWizardDraftEnvelope
): CanonicalWizardDraftEnvelope {
  const photos = parseDenaliTourPhotos(getCanonicalValueFromDraft(draft, "photos"));
  const complete = photos.filter((photo) => isPersistableDenaliTourPhoto(photo));
  if (complete.length === photos.length) {
    return draft;
  }
  return setCanonicalValueOnDraft(draft, "photos", complete);
}

export function sanitizeItineraryPhotoIdsOnDraft(
  draft: CanonicalWizardDraftEnvelope
): CanonicalWizardDraftEnvelope {
  const allowedPhotoIds = collectAllowedPhotoIds(getCanonicalValueFromDraft(draft, "photos"));
  const rawItinerary = getCanonicalValueFromDraft(draft, "program.itinerary");
  const parsed = parseDenaliItineraryDays(rawItinerary);
  if (parsed.length === 0) {
    return draft;
  }
  const pruned = pruneItinerarySegmentPhotoIds(parsed, allowedPhotoIds);
  const unchanged = pruned.every((day, dayIndex) => {
    const original = parsed[dayIndex];
    if (original == null) {
      return false;
    }
    return JSON.stringify(day) === JSON.stringify(original);
  });
  if (unchanged) {
    return draft;
  }
  return setCanonicalValueOnDraft(draft, "program.itinerary", pruned);
}

export function sanitizeItineraryDestinationIdsOnDraft(
  draft: CanonicalWizardDraftEnvelope,
  allowedDestinationIds: readonly string[] | undefined
): CanonicalWizardDraftEnvelope {
  if (allowedDestinationIds === undefined) {
    return draft;
  }
  const allowed = new Set(allowedDestinationIds);
  const rawItinerary = getCanonicalValueFromDraft(draft, "program.itinerary");
  const parsed = parseDenaliItineraryDays(rawItinerary);
  if (parsed.length === 0) {
    return draft;
  }
  const pruned = pruneItinerarySegmentDestinationIds(parsed, allowed);
  const unchanged = pruned.every((day, dayIndex) => {
    const original = parsed[dayIndex];
    if (original == null) {
      return false;
    }
    return JSON.stringify(day) === JSON.stringify(original);
  });
  if (unchanged) {
    return draft;
  }
  return setCanonicalValueOnDraft(draft, "program.itinerary", pruned);
}

/** BFF routes for operator catalog fetch during wizard submit (web adapter). */
export const DENALI_SUBMIT_CATALOG_BFF_PATHS = Object.freeze({
  equipment: "/api/settings/resources/equipment",
  tourThemes: "/api/settings/resources/tour_themes",
  guideLanguages: "/api/settings/resources/guide_languages",
  locations: "/api/settings/resources/locations",
  activeUsers: "/api/users?role=all&status=active&limit=100",
});

export type DenaliSubmitCatalogIds = {
  readonly activeEquipmentIds?: readonly string[];
  readonly activeThemeIds?: readonly string[];
  readonly activeGuideLanguageIds?: readonly string[];
  readonly selectableLeaderIds?: readonly string[];
  readonly activeDestinationIds?: readonly string[];
};

const LEADER_ELIGIBILITY_REWARD_LABELS = new Set([
  "admin",
  "leader",
  "لیدر",
  "راهنما",
]);

export function isWizardLeaderCandidate(user: {
  readonly userId: string;
  readonly role: string;
  readonly isSelectableLeader?: boolean;
  readonly labels?: readonly string[];
}): boolean {
  if (user.isSelectableLeader === true || user.role === "admin" || user.role === "owner") {
    return true;
  }
  for (const label of user.labels ?? []) {
    if (LEADER_ELIGIBILITY_REWARD_LABELS.has(label.trim().toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function readActiveThemeIds(
  items: ReadonlyArray<{ id: string; isActive?: boolean }>
): readonly string[] {
  return items
    .filter((item) => item.isActive !== false)
    .map((item) => item.id.trim())
    .filter((id) => id.length > 0);
}

export function readActiveGuideLanguageIds(
  items: ReadonlyArray<{ id: string; isActive?: boolean }>
): readonly string[] {
  return readActiveThemeIds(items);
}

export function readActiveEquipmentIds(
  items: ReadonlyArray<{ id: string; isActive?: boolean }>
): readonly string[] {
  return readActiveThemeIds(items);
}

export function readActiveDestinationIds(
  items: ReadonlyArray<{ id: string; isActive?: boolean }>
): readonly string[] {
  return readActiveThemeIds(items);
}

export function readSelectableLeaderUserIds(
  items: ReadonlyArray<{
    userId: string;
    role: string;
    isSelectableLeader?: boolean;
    labels?: readonly string[];
  }>
): readonly string[] {
  return items
    .filter((user) => isWizardLeaderCandidate(user))
    .map((user) => user.userId.trim())
    .filter((id) => id.length > 0);
}

export function resolveMainThemeFormProfileFromCatalog(
  themeIds: unknown,
  catalog: readonly { id: string; formProfile?: string | null }[]
): string | undefined {
  const ids = parseStringArray(themeIds);
  const firstId = ids[0];
  if (firstId === undefined) {
    return undefined;
  }
  const profile = catalog.find((theme) => theme.id === firstId)?.formProfile?.trim();
  return profile !== undefined && profile.length > 0 ? profile : undefined;
}

export function aggregateDenaliSubmitCatalogIds(input: {
  readonly equipmentItems?: ReadonlyArray<{ id: string; isActive?: boolean }>;
  readonly themeItems?: ReadonlyArray<{ id: string; isActive?: boolean }>;
  readonly guideLanguageItems?: ReadonlyArray<{ id: string; isActive?: boolean }>;
  readonly destinationItems?: ReadonlyArray<{ id: string; isActive?: boolean }>;
  readonly userItems?: ReadonlyArray<{
    userId: string;
    role: string;
    isSelectableLeader?: boolean;
    labels?: readonly string[];
  }>;
}): DenaliSubmitCatalogIds {
  return {
    ...(input.equipmentItems !== undefined
      ? { activeEquipmentIds: readActiveEquipmentIds(input.equipmentItems) }
      : {}),
    ...(input.themeItems !== undefined ? { activeThemeIds: readActiveThemeIds(input.themeItems) } : {}),
    ...(input.guideLanguageItems !== undefined
      ? { activeGuideLanguageIds: readActiveGuideLanguageIds(input.guideLanguageItems) }
      : {}),
    ...(input.destinationItems !== undefined
      ? { activeDestinationIds: readActiveDestinationIds(input.destinationItems) }
      : {}),
    ...(input.userItems !== undefined
      ? { selectableLeaderIds: readSelectableLeaderUserIds(input.userItems) }
      : {}),
  };
}
