import { createHash } from "node:crypto";

import { withTenantRls } from "../../db/with-tenant-rls";
import {
  getBackgroundAdminClient,
  BACKGROUND_ADMIN_REASON,
} from "../../db/background-admin-client";
import type { IntegrationDeliveryJobRecord } from "../platform/integration-delivery.types";

function hashRecipient(recipient: string): string {
  return createHash("sha256").update(recipient.trim()).digest("hex");
}

/** Reserve an attempt before contacting the provider; uncertain earlier attempts
 * must be reconciled rather than blindly sent a second time. */
export async function prepareSmsUsageAttempt(
  job: IntegrationDeliveryJobRecord,
  recipient: string
): Promise<"ready" | "already_sent" | "unknown"> {
  if (job.deliveryScope === "platform") {
    assertPlatformSmsJob(job);
    const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_INTEGRATION_DELIVERY);
    const previous = await admin.platformSmsUsageEvent.findFirst({
      where: { deliveryJobId: job.id },
      orderBy: { attemptNumber: "desc" },
      select: { status: true },
    });
    if (previous?.status === "sent") return "already_sent";
    if (previous?.status === "attempted" || previous?.status === "unknown") return "unknown";
    await admin.platformSmsUsageEvent.create({
      data: {
        deliveryJobId: job.id,
        attemptNumber: job.attemptCount + 1,
        provider: job.provider,
        purpose: "platform_ops_login",
        templateKey: "auth.otp",
        recipientHash: hashRecipient(recipient),
        status: "attempted",
      },
    });
    return "ready";
  }
  if (job.tenantId === null) throw new Error("INTEGRATION_DELIVERY_TENANT_REQUIRED");
  const tenantId = job.tenantId;
  return withTenantRls(tenantId, async (tx) => {
    const previous = await tx.smsUsageEvent.findFirst({
      where: { tenantId, deliveryJobId: job.id },
      orderBy: { attemptNumber: "desc" },
      select: { status: true },
    });
    if (previous?.status === "sent") return "already_sent";
    if (previous?.status === "attempted" || previous?.status === "unknown") return "unknown";
    await tx.smsUsageEvent.create({
      data: {
        tenantId,
        workspaceType:
          typeof job.payload.workspaceType === "string" ? job.payload.workspaceType : null,
        deliveryJobId: job.id,
        attemptNumber: job.attemptCount + 1,
        provider: job.provider,
        purpose:
          typeof job.payload.smsPurpose === "string" ? job.payload.smsPurpose : job.eventType,
        templateKey:
          typeof job.payload.smsTemplateKey === "string" ? job.payload.smsTemplateKey : null,
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

  if (input.job.deliveryScope === "platform") {
    assertPlatformSmsJob(input.job);
    const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_INTEGRATION_DELIVERY);
    await admin.platformSmsUsageEvent.upsert({
      where: {
        deliveryJobId_attemptNumber: {
          deliveryJobId: input.job.id,
          attemptNumber: input.job.attemptCount + 1,
        },
      },
      create: {
        deliveryJobId: input.job.id,
        attemptNumber: input.job.attemptCount + 1,
        provider: input.job.provider,
        purpose: "platform_ops_login",
        templateKey: "auth.otp",
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
    return;
  }
  if (input.job.tenantId === null) throw new Error("INTEGRATION_DELIVERY_TENANT_REQUIRED");
  const tenantId = input.job.tenantId;

  await withTenantRls(tenantId, async (tx) => {
    await tx.smsUsageEvent.upsert({
      where: {
        deliveryJobId_attemptNumber: {
          deliveryJobId: input.job.id,
          attemptNumber: input.job.attemptCount + 1,
        },
      },
      create: {
        tenantId,
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

function assertPlatformSmsJob(job: IntegrationDeliveryJobRecord): void {
  if (
    job.tenantId !== null ||
    job.deliveryScope !== "platform" ||
    job.provider !== "melipayamak" ||
    job.capability !== "sms.send" ||
    job.eventType !== "auth.otp.requested" ||
    job.payload.smsDeliverySource !== "platform" ||
    job.payload.smsPurpose !== "platform_ops_login"
  ) {
    throw new Error("PLATFORM_SMS_JOB_INVALID");
  }
}
