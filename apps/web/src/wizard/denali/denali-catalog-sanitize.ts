import type {
  DestinationResource,
  TourThemeResource,
} from "@/features/settings/settings-module-types";
import type { UsersDirectoryRow } from "@/features/users/users-directory-types";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import { parseStringArray } from "./denali-array-field-utils";

/** Custom user labels that grant tour-leader eligibility (Users → rewards). */
const LEADER_ELIGIBILITY_REWARD_LABELS = new Set([
  "admin",
  "leader",
  "لیدر",
  "راهنما",
]);

export function isWizardLeaderCandidate(
  user: Pick<UsersDirectoryRow, "userId" | "role" | "isSelectableLeader" | "labels"> | {
    readonly userId: string;
    readonly role: string;
    readonly isSelectableLeader?: boolean;
    readonly labels?: readonly string[];
  }
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
  return items
    .filter((item) => item.isActive !== false)
    .map((item) => item.id.trim())
    .filter((id) => id.length > 0);
}

export function readActiveDestinationIds(
  items: readonly Pick<DestinationResource, "id" | "isActive">[]
): readonly string[] {
  return items
    .filter((item) => item.isActive !== false)
    .map((item) => item.id.trim())
    .filter((id) => id.length > 0);
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
