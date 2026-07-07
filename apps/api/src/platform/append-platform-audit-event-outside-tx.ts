import { getPrismaAdmin } from "../db/prisma.ts";
import {
  appendPlatformAuditEvent,
  type AppendPlatformAuditEventInput,
} from "./platform-audit-logger";

export async function appendPlatformAuditEventOutsideTx(
  input: AppendPlatformAuditEventInput
): Promise<void> {
  const prisma = getPrismaAdmin();
  await prisma.$transaction(async (tx) => {
    await appendPlatformAuditEvent(tx, input);
  });
}
