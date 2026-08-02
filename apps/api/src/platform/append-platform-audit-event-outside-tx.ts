import {
  PLATFORM_ADMIN_REASON,
  getPlatformAdminClient,
} from "./platform-admin-client.ts";
import {
  appendPlatformAuditEvent,
  type AppendPlatformAuditEventInput,
} from "./platform-audit-logger";

export async function appendPlatformAuditEventOutsideTx(
  input: AppendPlatformAuditEventInput
): Promise<void> {
  const prisma = getPlatformAdminClient(PLATFORM_ADMIN_REASON.PLATFORM_AUDIT);
  await prisma.$transaction(async (tx) => {
    await appendPlatformAuditEvent(tx, input);
  });
}
