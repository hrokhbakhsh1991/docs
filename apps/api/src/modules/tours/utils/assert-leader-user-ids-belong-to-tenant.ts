import { BadRequestException } from "@nestjs/common";
import { isEligibleTourLeaderMembership } from "@repo/shared";
import { In, IsNull, type Repository } from "typeorm";

import { MembershipStatus } from "../../identity/membership-status.enum";
import { UserTenantEntity } from "../../identity/entities/user-tenant.entity";
import type { TourTripDetails } from "../types/tour-trip-details.types";

function dedupeUuidStrings(ids: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of ids) {
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function collectLeaderUserIdsFromTripDetails(
  trip: TourTripDetails | null | undefined,
): string[] {
  if (trip == null || typeof trip !== "object") {
    return [];
  }
  const raw = trip.overview?.leaderUserIds;
  return Array.isArray(raw) ? dedupeUuidStrings(raw) : [];
}

/**
 * Ensures every `leaderUserIds` entry is an ACTIVE member of `tenantId` and eligible
 * to lead tours (crew role or selectable-leader capability).
 */
export async function assertLeaderUserIdsBelongToTenant(
  membershipRepository: Repository<UserTenantEntity>,
  tenantId: string,
  leaderUserIds: string[] | null | undefined,
): Promise<void> {
  const unique = dedupeUuidStrings(leaderUserIds ?? []);
  if (unique.length === 0) {
    return;
  }

  const rows = await membershipRepository.find({
    where: {
      tenantId,
      userId: In(unique),
      deletedAt: IsNull(),
      status: MembershipStatus.ACTIVE,
    },
    select: {
      userId: true,
      role: true,
      membershipMetadata: true,
    },
  });

  const byUserId = new Map(rows.map((r) => [r.userId, r]));
  const notInTenant = unique.filter((id) => !byUserId.has(id));
  if (notInTenant.length > 0) {
    throw new BadRequestException({
      error: {
        code: "INVALID_LEADER_USER_IDS_FOR_TENANT",
        message:
          "برخی شناسه‌های راهبر در این ورک‌اسپیس یافت نشد یا عضو فعال نیستند.",
        details: { invalidIds: notInTenant },
      },
    });
  }

  const ineligible = unique.filter((id) => {
    const row = byUserId.get(id)!;
    return !isEligibleTourLeaderMembership(row.role, row.membershipMetadata);
  });
  if (ineligible.length > 0) {
    throw new BadRequestException({
      error: {
        code: "LEADER_USER_NOT_ELIGIBLE",
        message: "این عضو مجوز انتخاب به‌عنوان راهبر تور را ندارد.",
        details: { invalidIds: ineligible },
      },
    });
  }
}
