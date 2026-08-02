import {
  PLATFORM_ADMIN_REASON,
  getPlatformAdminClient,
} from "./platform-admin-client.ts";

export type ImpersonationOwnerSubject = {
  readonly userId: string;
  readonly sessionVersion: number;
};

export async function resolveImpersonationOwnerSubject(
  tenantId: string
): Promise<ImpersonationOwnerSubject | null> {
  const prisma = getPlatformAdminClient(PLATFORM_ADMIN_REASON.PLATFORM_IMPERSONATION);
  const row = await prisma.userTenant.findFirst({
    where: { tenantId, role: "owner", status: "ACTIVE" },
    select: { userId: true, sessionVersion: true },
  });
  if (!row) return null;
  return { userId: row.userId, sessionVersion: row.sessionVersion };
}
