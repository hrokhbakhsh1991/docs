import type { UsersListQuery } from "./users.types";
import type { MembershipWithUserRecord } from "./identity-membership-records.types";
import type { UsersDirectoryListFilters } from "./users-directory-list-projection";

function displayNameForPair(pair: MembershipWithUserRecord): string {
  const profileName = pair.membership.displayName?.trim();
  if (profileName !== undefined && profileName.length > 0) {
    return profileName;
  }
  return pair.user.mobile;
}

function contactKeyForPair(pair: MembershipWithUserRecord): string {
  return (pair.membership.email ?? pair.user.mobile).toLocaleLowerCase();
}

export function matchesDirectoryPair(
  pair: MembershipWithUserRecord,
  filters: UsersDirectoryListFilters
): boolean {
  if (filters.role !== undefined && filters.role !== "all" && pair.membership.role !== filters.role) {
    return false;
  }

  if (filters.status === "active" && pair.membership.status !== "ACTIVE") {
    return false;
  }
  if (filters.status === "suspended" && pair.membership.status !== "SUSPENDED") {
    return false;
  }

  const search = filters.search?.trim();
  if (search !== undefined && search.length > 0) {
    const needle = search.toLocaleLowerCase();
    const haystacks = [
      displayNameForPair(pair),
      pair.user.mobile,
      pair.membership.email ?? "",
    ];
    if (!haystacks.some((value) => value.toLocaleLowerCase().includes(needle))) {
      return false;
    }
  }

  return true;
}

export function sortDirectoryPairs(
  pairs: readonly MembershipWithUserRecord[],
  sort: UsersListQuery["sort"]
): MembershipWithUserRecord[] {
  const sorted = [...pairs];
  sorted.sort((left, right) => {
    if (sort === "email_asc" || sort === "email_desc") {
      const delta = contactKeyForPair(left).localeCompare(contactKeyForPair(right));
      return sort === "email_desc" ? -delta : delta;
    }
    const delta = displayNameForPair(left).localeCompare(displayNameForPair(right));
    return sort === "name_desc" ? -delta : delta;
  });
  return sorted;
}
