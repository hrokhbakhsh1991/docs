import { getPrismaAdmin } from "../db/prisma.ts";

import { purgePlatformTenant } from "./purge-platform-tenant.ts";

export async function processScheduledTenantDeletions(actorId: string): Promise<{ purged: string[] }> {
  const prisma = getPrismaAdmin();
  const due = await prisma.tenant.findMany({
    where: { status: "offboarding", scheduledDeletionAt: { lte: new Date() } },
    select: { id: true },
  });
  const purged: string[] = [];
  for (const row of due) {
    if (await purgePlatformTenant({ tenantId: row.id, actorId })) {
      purged.push(row.id);
    }
  }
  return { purged };
}
