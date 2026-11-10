import { createHash } from "node:crypto";

import { withTenantRls } from "../../db/with-tenant-rls";
import type { IntegrationDeliveryJobRecord } from "../platform/integration-delivery.types";

function hashRecipient(recipient: string): string {
  return createHash("sha256").update(recipient.trim()).digest("hex");
}

/** Reserve an attempt before contacting the provider; uncertain earlier attempts
 * must be reconciled rather than blindly sent a second time. */
export async function prepareSmsUsageAttempt(job: IntegrationDeliveryJobRecord, recipient: string): Promise<"ready" | "already_sent" | "unknown"> {
  return withTenantRls(job.tenantId, async (tx) => {
    const previous = await tx.smsUsageEvent.findFirst({
      where: { tenantId: job.tenantId, deliveryJobId: job.id },
      orderBy: { attemptNumber: "desc" },
      select: { status: true },
    });
    if (previous?.status === "sent") return "already_sent";
    if (previous?.status === "attempted" || previous?.status === "unknown") return "unknown";
    await tx.smsUsageEvent.create({
      data: {
        tenantId: job.tenantId,
        workspaceType: typeof job.payload.workspaceType === "string" ? job.payload.workspaceType : null,
        deliveryJobId: job.id,
        attemptNumber: job.attemptCount + 1,
        provider: job.provider,
        purpose: typeof job.payload.smsPurpose === "string" ? job.payload.smsPurpose : job.eventType,
        templateKey: typeof job.payload.smsTemplateKey === "string" ? job.payload.smsTemplateKey : null,
        recipientHash: hashRecipient(recipient),
        status: "attempted",
      },
    });
    return "ready";
  });
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
