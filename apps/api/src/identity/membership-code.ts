import type { Prisma } from "@prisma/client";

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
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      ('x' || substr(md5(${tenantId}), 1, 8))::bit(32)::int,
      ('x' || substr(md5(${tenantId}), 9, 8))::bit(32)::int
    )
  `;

  const rows = await tx.$queryRaw<Array<{ subdomain: string; nextSequence: number | string | bigint | null }>>`
    SELECT
      t."subdomain",
      COALESCE(MAX(NULLIF(SUBSTRING(ut."membership_code" FROM '([0-9]+)$'), '')::bigint), 0) + 1 AS "nextSequence"
    FROM "tenants" t
    LEFT JOIN "user_tenants" ut ON ut."tenant_id" = t."id"
    WHERE t."id" = ${tenantId}::uuid
    GROUP BY t."subdomain"
  `;
  const row = rows[0];
  if (row === undefined) {
    throw new Error("MEMBERSHIP_CODE_TENANT_NOT_FOUND");
  }
  return formatMembershipCode(row.subdomain, Number(row.nextSequence ?? 1));
}
