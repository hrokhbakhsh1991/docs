import type { Prisma } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";

const MEMBERSHIP_CODE_WIDTH = 6;

export function membershipCodePrefix(subdomain: string): string {
  const prefix = subdomain
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
  return prefix.length > 0 ? prefix : "WORKSPACE";
}

export function formatMembershipCode(prefix: string, sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("MEMBERSHIP_CODE_SEQUENCE_INVALID");
  }
  return `${membershipCodePrefix(prefix)}-${String(sequence).padStart(MEMBERSHIP_CODE_WIDTH, "0")}`;
}

/**
 * Allocates the next code while holding a tenant-scoped advisory transaction lock.
 * The lock prevents duplicate codes when two memberships are created concurrently.
 */
export async function allocateMembershipCode(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<string> {
  const tenant = await getPrismaAdmin().tenant.findUnique({
    where: { id: tenantId },
    select: { subdomain: true },
  });
  if (tenant === null) {
    throw new Error("MEMBERSHIP_CODE_TENANT_NOT_FOUND");
  }

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      ('x' || substr(md5(${tenantId}), 1, 8))::bit(32)::int,
      ('x' || substr(md5(${tenantId}), 9, 8))::bit(32)::int
    )
  `;

  const rows = await tx.$queryRaw<Array<{ nextSequence: number | string | bigint | null }>>`
    SELECT
      COALESCE(MAX(NULLIF(SUBSTRING(ut."membership_code" FROM '([0-9]+)$'), '')::bigint), 0) + 1 AS "nextSequence"
    FROM "user_tenants" ut
    WHERE ut."tenant_id" = ${tenantId}::uuid
  `;
  const row = rows[0];
  if (row === undefined) {
    throw new Error("MEMBERSHIP_CODE_TENANT_NOT_FOUND");
  }
  return formatMembershipCode(tenant.subdomain, Number(row.nextSequence ?? 1));
}
