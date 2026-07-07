import { getPrismaAdmin } from "../db/prisma.ts";

export type ImpersonationOwnerSubject = {
  readonly userId: string;
  readonly sessionVersion: number;
};

export async function resolveImpersonationOwnerSubject(
  tenantId: string
): Promise<ImpersonationOwnerSubject | null> {
  const prisma = getPrismaAdmin();
  const row = await prisma.userTenant.findFirst({
    where: { tenantId, role: "owner", status: "ACTIVE" },
    select: { userId: true, sessionVersion: true },
  });
  if (!row) return null;
  return { userId: row.userId, sessionVersion: row.sessionVersion };
}
