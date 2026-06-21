import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

/**
 * P1-N-057: Invite tenant owner via platform admin repository.
 * Creates a pending invite with "owner" role for the new tenant.
 */
export async function inviteTenantOwner(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    phone: string;
    nameNote?: string;
    invitedByUserId: string;
  }
): Promise<{ inviteId: string; inviteToken: string }> {
  const inviteId = randomUUID();
  const inviteToken = randomUUID();

  await tx.operatorPendingInvite.create({
    data: {
      inviteId,
      inviteToken,
      tenantId: input.tenantId,
      phone: input.phone,
      role: "owner",
      status: "INVITED",
      ...(input.nameNote ? { nameNote: input.nameNote } : {}),
      invitedByUserId: input.invitedByUserId,
    },
  });

  return { inviteId, inviteToken };
}

// Made with Bob
