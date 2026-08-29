import type { UsersDirectoryQuery, UsersDirectoryRow } from "./users-directory-types";

export const USERS_DIRECTORY_PAGE_SIZE = 25;

export const USERS_DIRECTORY_SORT_OPTIONS = [
  "name_asc",
  "name_desc",
  "email_asc",
  "email_desc",
] as const;

export type UsersDirectorySortOption = (typeof USERS_DIRECTORY_SORT_OPTIONS)[number];

const USERS_DIRECTORY_CURSOR_PREFIX = "v1:" as const;

export function encodeUsersDirectoryPageCursor(offset: number): string {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("USERS_DIRECTORY_CURSOR_OFFSET_INVALID");
  }
  return `${USERS_DIRECTORY_CURSOR_PREFIX}${offset}`;
}

export function resolveUsersDirectoryOffset(
  page: number,
  pageSize: number = USERS_DIRECTORY_PAGE_SIZE
): number {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  return (safePage - 1) * pageSize;
}

export function resolveUsersDirectoryTotalPages(
  total: number,
  pageSize: number = USERS_DIRECTORY_PAGE_SIZE
): number {
  if (total <= 0) {
    return 1;
  }
  return Math.ceil(total / pageSize);
}

export function buildUsersListFetchQuery(query: UsersDirectoryQuery): string {
  const params = new URLSearchParams();
  const search = query.search.trim();
  if (search.length > 0) {
    params.set("search", search);
  }
  if (query.role !== "all") {
    params.set("role", query.role);
  }
  if (query.status !== "all") {
    params.set("status", query.status);
  }
  params.set("sort", query.sort);
  params.set("limit", String(USERS_DIRECTORY_PAGE_SIZE));
  const offset = resolveUsersDirectoryOffset(query.page);
  if (offset > 0) {
    params.set("cursor", encodeUsersDirectoryPageCursor(offset));
  }
  return params.toString();
}

export function mergeUsersDirectoryPages(
  existing: readonly UsersDirectoryRow[],
  incoming: readonly UsersDirectoryRow[]
): UsersDirectoryRow[] {
  const seen = new Set(existing.map((row) => row.userId));
  const merged = [...existing];
  for (const row of incoming) {
    if (!seen.has(row.userId)) {
      merged.push(row);
      seen.add(row.userId);
    }
  }
  return merged;
}

export function formatUserLastActive(
  lastActiveAt: string | null | undefined,
  locale: string
): string {
  if (lastActiveAt === null || lastActiveAt === undefined || lastActiveAt.length === 0) {
    return "—";
  }
  const parsed = new Date(lastActiveAt);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString(locale, { dateStyle: "medium" });
}
