import {
  getCanonicalValueFromDraft,
  setCanonicalValueOnDraft,
  type CanonicalWizardDraftEnvelope,
} from "./canonical-draft-access";

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
