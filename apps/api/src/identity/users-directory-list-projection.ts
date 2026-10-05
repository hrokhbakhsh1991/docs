import { buildIranMobileSearchPatterns } from "@app-tour/iran-mobile";
import type { Prisma } from "@prisma/client";

import type { UsersListQuery } from "./users.types";

export type UsersDirectoryListFilters = {
  readonly search?: string;
  readonly role?: UsersListQuery["role"];
  readonly status?: UsersListQuery["status"];
};

export const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildUserTenantDirectoryWhere(
  tenantId: string,
  filters: UsersDirectoryListFilters
): Prisma.UserTenantWhereInput {
  const where: Prisma.UserTenantWhereInput = { tenantId };

  if (filters.role !== undefined && filters.role !== "all") {
    where.role = filters.role;
  }

  if (filters.status === "active") {
    where.status = "ACTIVE";
  } else if (filters.status === "suspended") {
    where.status = "SUSPENDED";
  }

  const search = filters.search?.trim();
  if (search !== undefined && search.length > 0) {
    const phoneNeedles = new Set<string>([search]);
    for (const pattern of buildIranMobileSearchPatterns(search)) {
      const needle = pattern.replace(/^%|%$/g, "");
      if (needle.length > 0) {
        phoneNeedles.add(needle);
      }
    }
    where.OR = [
      ...(USER_ID_PATTERN.test(search) ? [{ user: { id: search } }] : []),
      ...[...phoneNeedles].map((needle) => ({
        user: { mobile: { contains: needle, mode: "insensitive" as const } },
      })),
      {
        membershipMetadata: {
          path: ["displayName"],
          string_contains: search,
          mode: "insensitive",
        },
      },
      { membershipCode: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}
