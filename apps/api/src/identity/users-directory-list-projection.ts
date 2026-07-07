import type { Prisma } from "@prisma/client";

import type { UsersListQuery } from "./users.types";

export type UsersDirectoryListFilters = {
  readonly search?: string;
  readonly role?: UsersListQuery["role"];
  readonly status?: UsersListQuery["status"];
};

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
    where.OR = [
      { user: { mobile: { contains: search, mode: "insensitive" } } },
      {
        membershipMetadata: {
          path: ["displayName"],
          string_contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  return where;
}
