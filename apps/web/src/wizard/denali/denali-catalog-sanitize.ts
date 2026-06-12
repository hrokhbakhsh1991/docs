import type { GuideLanguageResource, TourThemeResource } from "@/features/settings/settings-module-types";
import type { UsersDirectoryRow } from "@/features/users/users-directory-types";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import { parseStringArray } from "./denali-array-field-utils";

/** Reward labels that grant tour-leader eligibility without RBAC admin role (Legacy parity). */
const LEADER_ELIGIBILITY_REWARD_LABELS = new Set(["admin"]);

export function isWizardLeaderCandidate(
  user: Pick<UsersDirectoryRow, "userId" | "role" | "isSelectableLeader" | "labels">
): boolean {
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
  items: readonly Pick<TourThemeResource, "id" | "isActive">[]
): readonly string[] {
  return items
    .filter((item) => item.isActive !== false)
    .map((item) => item.id.trim())
    .filter((id) => id.length > 0);
}

export function readActiveGuideLanguageIds(
  items: readonly Pick<GuideLanguageResource, "id" | "isActive">[]
): readonly string[] {
  return items
    .filter((item) => item.isActive !== false)
    .map((item) => item.id.trim())
    .filter((id) => id.length > 0);
}

export function readSelectableLeaderUserIds(
  items: readonly Pick<UsersDirectoryRow, "userId" | "role" | "isSelectableLeader" | "labels">[]
): readonly string[] {
  return items
    .filter((user) => isWizardLeaderCandidate(user))
    .map((user) => user.userId.trim())
    .filter((id) => id.length > 0);
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

export function resolveMainThemeFormProfileFromCatalog(
  themeIds: unknown,
  catalog: readonly Pick<TourThemeResource, "id" | "formProfile">[]
): string | undefined {
  const firstId = parseStringArray(themeIds)[0];
  if (firstId === undefined) {
    return undefined;
  }
  const profile = catalog.find((theme) => theme.id === firstId)?.formProfile?.trim();
  return profile !== undefined && profile.length > 0 ? profile : undefined;
}

export function sanitizeLeaderUserIdsOnDraft(
  draft: TourWizardDraft,
  selectableLeaderIds: readonly string[] | undefined
): TourWizardDraft {
  const filtered = filterIdsToAllowedCatalog(
    getCanonicalValue(draft, "leaderUserIds"),
    selectableLeaderIds
  );
  return setCanonicalValue(draft, "leaderUserIds", filtered);
}

export function sanitizeThemeIdsOnDraft(
  draft: TourWizardDraft,
  activeThemeIds: readonly string[] | undefined
): TourWizardDraft {
  const filtered = filterIdsToAllowedCatalog(
    getCanonicalValue(draft, "program.themeIds"),
    activeThemeIds
  );
  return setCanonicalValue(draft, "program.themeIds", filtered);
}

export function sanitizeGuideLanguageIdsOnDraft(
  draft: TourWizardDraft,
  activeGuideLanguageIds: readonly string[] | undefined
): TourWizardDraft {
  const filtered = filterIdsToAllowedCatalog(
    getCanonicalValue(draft, "program.guideLanguageIds"),
    activeGuideLanguageIds
  );
  return setCanonicalValue(draft, "program.guideLanguageIds", filtered);
}
