import { createHash } from "node:crypto";

import { withTenantRls } from "../../db/with-tenant-rls";
import type { IntegrationDeliveryJobRecord } from "../platform/integration-delivery.types";

function hashRecipient(recipient: string): string {
  return createHash("sha256").update(recipient.trim()).digest("hex");
}

export async function recordSmsUsageAttempt(input: {
  readonly job: IntegrationDeliveryJobRecord;
  readonly recipient: string;
  readonly status: "attempted" | "sent" | "failed" | "unknown";
  readonly providerMessageId?: string;
  readonly errorCode?: string;
}): Promise<void> {
  const payload = input.job.payload;
  const workspaceType = typeof payload.workspaceType === "string" ? payload.workspaceType : null;
  const purpose =
    typeof payload.smsPurpose === "string" && payload.smsPurpose.trim().length > 0
      ? payload.smsPurpose.trim()
      : input.job.eventType;
  const templateKey =
    typeof payload.smsTemplateKey === "string" && payload.smsTemplateKey.trim().length > 0
      ? payload.smsTemplateKey.trim()
      : null;

  await withTenantRls(input.job.tenantId, async (tx) => {
    await tx.smsUsageEvent.upsert({
      where: {
        deliveryJobId_attemptNumber: {
          deliveryJobId: input.job.id,
          attemptNumber: input.job.attemptCount + 1,
        },
      },
      create: {
        tenantId: input.job.tenantId,
        workspaceType,
        deliveryJobId: input.job.id,
        attemptNumber: input.job.attemptCount + 1,
        provider: input.job.provider,
        purpose,
        templateKey,
        recipientHash: hashRecipient(input.recipient),
        providerMessageId: input.providerMessageId,
        status: input.status,
        errorCode: input.errorCode,
      },
      update: {
        providerMessageId: input.providerMessageId,
        status: input.status,
        errorCode: input.errorCode,
      },
    });
  });
}
