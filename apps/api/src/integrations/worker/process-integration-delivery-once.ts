import { getIntegrationProvider } from "../platform/integration-provider-registry";
import { recordSmsUsageAttempt } from "../application/record-sms-usage";
import { decryptOtpDeliveryCode } from "../../identity/otp-delivery-secret";
import type { IntegrationDeliveryJobRecord } from "../platform/integration-delivery.types";
import type {
  IntegrationDeliveryContext,
  IntegrationProviderAdapter,
} from "../platform/integration-provider.types";
import type { IntegrationConnectionRecord } from "../platform/integration-connection.types";
import type { IntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";
import { resolveDeliveryConnection } from "../application/resolve-integration-connection-credentials";
import { formatIntegrationDeliveryMessage } from "../platform/format-integration-delivery-message";
import { computeRelayBackoff } from "../../resilience/compute-relay-backoff";
import {
  recordIntegrationDeliveryFailed,
  recordIntegrationDeliverySuccess,
} from "../../observability/metrics";
import { reclaimStaleProcessingIntegrationDeliveryJobs } from "./integration-delivery-processing-reclaim";
import {
  DEFAULT_TELEGRAM_FORUM_TOPIC_NAMES,
  TELEGRAM_FORUM_TOPIC_KEYS,
  type TelegramForumTopicKey,
} from "../providers/telegram/telegram-forum.config";
import { LEGACY_TELEGRAM_ID_PREFIX } from "../infrastructure/resolve-legacy-telegram-connection";
import { readMemberReceiptProof } from "../../workspace-finance/receipt-proof-storage";
import { resolveIntegrationMediaKindFromStorageKey } from "../application/resolve-integration-media";
import { resolveTourPublishedPdpUrl } from "../application/resolve-tour-published-pdp-url";
import { logger } from "../../observability/logger";
import { randomUUID } from "node:crypto";
import { TelegramApiError } from "../providers/telegram/telegram-api.client";
import type { TelegramTopicProvisionClaim } from "../infrastructure/integration-connection.repository";

const MAX_DELIVERY_ATTEMPTS = 8;
const TELEGRAM_MEDIA_CAPTION_MAX_LENGTH = 1024;

function telegramMediaCaption(text: string): string {
  if (text.length <= TELEGRAM_MEDIA_CAPTION_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, TELEGRAM_MEDIA_CAPTION_MAX_LENGTH - 1)}…`;
}

export type ProcessIntegrationDeliveryDeps = {
  readonly deliveryRepository: IntegrationDeliveryRepository;
  /** Injectable seams keep retry/reclaim behavior deterministic in unit tests. */
  readonly executeJob?: typeof executeIntegrationDeliveryJob;
  readonly reclaimStaleProcessingJobs?: typeof reclaimStaleProcessingIntegrationDeliveryJobs;
};

export type TelegramTopicAutoCreateApi = {
  createForumTopic(chatId: string, name: string): Promise<{ readonly message_thread_id: number }>;
};

export type ExecuteIntegrationDeliveryDeps = {
  readonly resolveConnection?: typeof resolveDeliveryConnection;
  readonly getProvider?: (
    provider: IntegrationDeliveryJobRecord["provider"]
  ) => IntegrationProviderAdapter | undefined;
  /** Injectable seam for the raw Telegram Bot API client used to recreate a confirmed stale topic. */
  readonly createTelegramTopicApi?: (botToken: string) => TelegramTopicAutoCreateApi;
  /** Injectable seams for the durable per-topic create lease. */
  readonly claimTelegramTopicProvision?: (input: {
    readonly tenantId: string;
    readonly connectionId: string;
    readonly topicKey: string;
    readonly leaseToken: string;
    readonly staleThreadId: number;
    readonly chatId?: string;
  }) => Promise<TelegramTopicProvisionClaim>;
  readonly completeTelegramTopicProvision?: (input: {
    readonly tenantId: string;
    readonly connectionId: string;
    readonly topicKey: string;
    readonly topicName: string;
    readonly threadId: number;
    readonly leaseToken: string;
    readonly chatId?: string;
  }) => Promise<"committed" | "stale" | void>;
  readonly finishTelegramTopicProvisionFailure?: (input: {
    readonly tenantId: string;
    readonly connectionId: string;
    readonly topicKey: string;
    readonly leaseToken: string;
    readonly outcomeUnknown: boolean;
    readonly chatId?: string;
  }) => Promise<void>;
  /** Injectable seam for resolving the anonymous public PDP URL in TourPublished messages. */
  readonly resolveTourPublishedPdpUrl?: typeof resolveTourPublishedPdpUrl;
};

/**
 * Forum-routed Telegram events must never silently fall back to the group's
 * General topic. A missing mapping is a configuration failure, not a valid
 * delivery destination.
 */
export function resolveTelegramDeliveryThreadId(input: {
  readonly config: Record<string, unknown>;
  readonly topicKey: string | null;
}): { readonly ok: true; readonly threadId?: number } | { readonly ok: false } {
  if (input.topicKey === null) {
    return { ok: true };
  }

  const topicThreadIds =
    typeof input.config.topicThreadIds === "object" && input.config.topicThreadIds !== null
      ? (input.config.topicThreadIds as Record<string, unknown>)
      : null;
  const rawThreadId = topicThreadIds?.[input.topicKey];
  if (typeof rawThreadId !== "number" || !Number.isSafeInteger(rawThreadId) || rawThreadId <= 0) {
    return { ok: false };
  }
  return { ok: true, threadId: rawThreadId };
}

/**
 * Telegram forum connections persist their stable destination as `chatId`.
 * Older/generic connections may still use `channelId`; preserve that value
 * first and only apply the fallback for Telegram.
 */
export function resolveIntegrationDeliveryChannelId(input: {
  readonly provider: IntegrationDeliveryJobRecord["provider"];
  readonly config: Record<string, unknown>;
}): string | null {
  if (typeof input.config.channelId === "string" && input.config.channelId.trim().length > 0) {
    return input.config.channelId.trim();
  }
  if (input.provider === "telegram") {
    return typeof input.config.chatId === "string" && input.config.chatId.trim().length > 0
      ? input.config.chatId.trim()
      : null;
  }
  return null;
}

/**
 * Auto-create is only safe for genuine Telegram forum connections (real
 * `integration_connections` rows with a Telegram `chatId`). Legacy
 * `WorkspaceTelegramBot`-backed connections predate forum topics entirely and
 * must keep failing closed rather than have topics silently invented for them.
 */
export function isTelegramTopicAutoCreateEligible(input: {
  readonly connectionId: string;
  readonly config: Record<string, unknown>;
}): boolean {
  if (input.connectionId.startsWith(LEGACY_TELEGRAM_ID_PREFIX)) {
    return false;
  }
  return typeof input.config.chatId === "string" && input.config.chatId.trim().length > 0;
}

function isKnownTelegramTopicKey(topicKey: string): topicKey is TelegramForumTopicKey {
  return (TELEGRAM_FORUM_TOPIC_KEYS as readonly string[]).includes(topicKey);
}

/**
 * The topic's name must remain stable once created. Prefer the name already
 * on record for this key; fall back to the workspace default only the first
 * time a topic is provisioned.
 */
export function resolveTelegramTopicName(input: {
  readonly config: Record<string, unknown>;
  readonly topicKey: string;
}): string {
  const topicNames =
    typeof input.config.topicNames === "object" && input.config.topicNames !== null
      ? (input.config.topicNames as Record<string, unknown>)
      : {};
  const stored = topicNames[input.topicKey];
  if (typeof stored === "string" && stored.trim().length > 0) {
    return stored;
  }
  return isKnownTelegramTopicKey(input.topicKey)
    ? DEFAULT_TELEGRAM_FORUM_TOPIC_NAMES[input.topicKey]
    : input.topicKey;
}

async function defaultCreateTelegramTopicApi(
  botToken: string
): Promise<TelegramTopicAutoCreateApi> {
  const { createTelegramApiClient } = await import("../providers/telegram/telegram-api.client");
  return createTelegramApiClient(botToken);
}

async function defaultClaimTelegramTopicProvision(input: {
  readonly tenantId: string;
  readonly connectionId: string;
  readonly topicKey: string;
  readonly leaseToken: string;
  readonly staleThreadId: number;
  readonly chatId?: string;
}): Promise<TelegramTopicProvisionClaim> {
  const { createIntegrationConnectionRepository } =
    await import("../infrastructure/prisma-integration-connection.repository");
  return createIntegrationConnectionRepository().claimTelegramTopicProvision(input);
}

async function defaultCompleteTelegramTopicProvision(input: {
  readonly tenantId: string;
  readonly connectionId: string;
  readonly topicKey: string;
  readonly topicName: string;
  readonly threadId: number;
  readonly leaseToken: string;
  readonly chatId?: string;
}): Promise<"committed" | "stale"> {
  const { createIntegrationConnectionRepository } =
    await import("../infrastructure/prisma-integration-connection.repository");
  return createIntegrationConnectionRepository().completeTelegramTopicProvision(input);
}

async function defaultFinishTelegramTopicProvisionFailure(input: {
  readonly tenantId: string;
  readonly connectionId: string;
  readonly topicKey: string;
  readonly leaseToken: string;
  readonly outcomeUnknown: boolean;
  readonly chatId?: string;
}): Promise<void> {
  const { createIntegrationConnectionRepository } =
    await import("../infrastructure/prisma-integration-connection.repository");
  await createIntegrationConnectionRepository().finishTelegramTopicProvisionFailure(input);
}

/**
 * Creates (or recreates, when Telegram reports the stored threadId is stale)
 * the forum topic for `topicKey` and persists the new threadId. Returns the
 * new threadId, or null when auto-create is not possible/eligible so callers
 * can fall back to the existing fail-closed behavior.
 */
async function autoCreateTelegramTopic(input: {
  readonly job: IntegrationDeliveryJobRecord;
  readonly connection: IntegrationConnectionRecord & {
    readonly credentials: Record<string, unknown>;
  };
  readonly connectionId: string;
  readonly chatId: string;
  readonly topicKey: string;
  readonly staleThreadId: number;
  readonly deps: ExecuteIntegrationDeliveryDeps;
}): Promise<number | null> {
  if (
    !isTelegramTopicAutoCreateEligible({
      connectionId: input.connectionId,
      config: input.connection.config,
    })
  ) {
    return null;
  }
  const botToken = input.connection.credentials.botToken;
  if (typeof botToken !== "string" || botToken.trim().length === 0) {
    return null;
  }

  const topicName = resolveTelegramTopicName({
    config: input.connection.config,
    topicKey: input.topicKey,
  });
  const leaseToken = randomUUID();
  const claim = await (
    input.deps.claimTelegramTopicProvision ?? defaultClaimTelegramTopicProvision
  )({
    tenantId: input.job.tenantId,
    connectionId: input.connectionId,
    topicKey: input.topicKey,
    leaseToken,
    staleThreadId: input.staleThreadId,
    chatId: input.chatId,
  });
  if (claim.status === "existing") return claim.threadId;
  if (claim.status !== "claimed") return null;

  try {
    const api = await (input.deps.createTelegramTopicApi ?? defaultCreateTelegramTopicApi)(
      botToken
    );
    const created = await api.createForumTopic(input.chatId, topicName);
    const completion = await (
      input.deps.completeTelegramTopicProvision ?? defaultCompleteTelegramTopicProvision
    )({
      tenantId: input.job.tenantId,
      connectionId: input.connectionId,
      topicKey: input.topicKey,
      topicName,
      threadId: created.message_thread_id,
      leaseToken,
      chatId: input.chatId,
    });
    // A late completion means the connection changed while Telegram was being
    // called. Do not send to the newly-created topic or persist it locally.
    return completion === "stale" ? null : created.message_thread_id;
  } catch (error: unknown) {
    const outcomeUnknown = !(error instanceof TelegramApiError) || error.errorCode === undefined;
    await (
      input.deps.finishTelegramTopicProvisionFailure ?? defaultFinishTelegramTopicProvisionFailure
    )({
      tenantId: input.job.tenantId,
      connectionId: input.connectionId,
      topicKey: input.topicKey,
      leaseToken,
      outcomeUnknown,
      chatId: input.chatId,
    });
    return null;
  }
}

function deliveryFailureReason(error: Record<string, unknown> | undefined): string {
  return typeof error?.code === "string" && error.code.trim().length > 0
    ? error.code
    : "INTEGRATION_DELIVERY_FAILED";
}

function logTelegramDeliverySuccess(input: {
  readonly job: IntegrationDeliveryJobRecord;
  readonly connectionId: string;
  readonly chatId: string;
  readonly topicKey: string | null;
  readonly threadId: number | undefined;
  readonly providerMessageId: string | undefined;
}): void {
  logger.info({
    event: "integration.telegram.delivery_succeeded",
    tenantId: input.job.tenantId,
    deliveryJobId: input.job.id,
    domainEventId: input.job.domainEventId,
    eventType: input.job.eventType,
    connectionId: input.connectionId,
    chatId: input.chatId,
    topicKey: input.topicKey,
    messageThreadId: input.threadId,
    providerMessageId: input.providerMessageId,
  });
}

async function safelyRecordSmsUsageAttempt(
  input: Parameters<typeof recordSmsUsageAttempt>[0]
): Promise<void> {
  try {
    await recordSmsUsageAttempt(input);
  } catch (error: unknown) {
    logger.error({
      event: "integration.sms_usage_record_failed",
      tenantId: input.job.tenantId,
      deliveryJobId: input.job.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function executeIntegrationDeliveryJob(
  job: IntegrationDeliveryJobRecord,
  deps: ExecuteIntegrationDeliveryDeps = {}
): Promise<{ readonly ok: boolean; readonly error?: Record<string, unknown> }> {
  const adapter = (deps.getProvider ?? getIntegrationProvider)(job.provider);
  if (adapter === undefined) {
    return { ok: false, error: { code: "INTEGRATION_PROVIDER_NOT_REGISTERED" } };
  }

  const workspaceType =
    typeof job.payload.workspaceType === "string" ? job.payload.workspaceType : null;
  const connectionId =
    typeof job.payload.integrationConnectionId === "string"
      ? job.payload.integrationConnectionId
      : null;

  const resolveConnection = deps.resolveConnection ?? resolveDeliveryConnection;
  const connection:
    | (IntegrationConnectionRecord & {
        readonly credentials: Record<string, unknown>;
      })
    | null =
    connectionId !== null
      ? await resolveConnection({
          tenantId: job.tenantId,
          connectionId,
          workspaceType,
        })
      : null;

  if (connection === null) {
    return { ok: false, error: { code: "INTEGRATION_CONNECTION_NOT_FOUND" } };
  }
  if (connectionId === null) {
    // Unreachable in practice (connection resolution requires a connectionId),
    // but narrows the type for the auto-create path below.
    return { ok: false, error: { code: "INTEGRATION_CONNECTION_NOT_FOUND" } };
  }

  const ctx: IntegrationDeliveryContext = {
    tenantId: job.tenantId,
    workspaceType,
    domainEventId: job.domainEventId,
    eventType: job.eventType,
    config: connection.config,
    credentials: connection.credentials,
  };

  if (job.provider === "melipayamak" && job.capability === "sms.send") {
    if (adapter.sendSms === undefined) {
      return { ok: false, error: { code: "MELIPAYAMAK_ADAPTER_UNSUPPORTED" } };
    }
    const recipient = typeof job.payload.recipient === "string" ? job.payload.recipient : "";
    const templateId =
      typeof job.payload.smsTemplateId === "string" ? job.payload.smsTemplateId : "";
    const plainVariables = Array.isArray(job.payload.smsVariables)
      ? job.payload.smsVariables.filter((value): value is string => typeof value === "string")
      : [];
    const encryptedOtp =
      typeof job.payload.smsEncryptedVariables === "string"
        ? job.payload.smsEncryptedVariables
        : null;
    let variables = plainVariables;
    if (encryptedOtp !== null) {
      try {
        const workspaceName =
          typeof job.payload.smsWorkspaceName === "string"
            ? job.payload.smsWorkspaceName.trim()
            : "";
        const code = decryptOtpDeliveryCode(encryptedOtp);
        // Keep the existing one-placeholder Pattern compatible: the provider
        // receives one clean variable containing the numeric code and name.
        variables = [workspaceName.length === 0 ? code : `${code} ${workspaceName}`];
      } catch {
        return { ok: false, error: { code: "SMS_DELIVERY_SECRET_INVALID" } };
      }
    }
    const result = await adapter.sendSms(ctx, { recipient, templateId, variables });
    await safelyRecordSmsUsageAttempt({
      job,
      recipient,
      status: result.ok ? "sent" : "failed",
      ...(result.providerMessageId === undefined
        ? {}
        : { providerMessageId: result.providerMessageId }),
      ...(result.errorCode === undefined ? {} : { errorCode: result.errorCode }),
    });
    return result.ok
      ? { ok: true }
      : { ok: false, error: { code: result.errorCode, message: result.errorMessage } };
  }

  const channelId = resolveIntegrationDeliveryChannelId({
    provider: job.provider,
    config: connection.config,
  });

  if (job.capability === "message.send") {
    if (channelId === null) {
      return { ok: false, error: { code: "INTEGRATION_CONFIG_INCOMPLETE" } };
    }
    const topicKey =
      typeof job.payload.telegramTopicKey === "string" ? job.payload.telegramTopicKey : null;
    const topicResolution = resolveTelegramDeliveryThreadId({
      config: connection.config,
      topicKey,
    });
    let resolvedThreadId = topicResolution.ok ? topicResolution.threadId : undefined;
    if (!topicResolution.ok && topicKey !== null && job.provider === "telegram") {
      resolvedThreadId =
        (await autoCreateTelegramTopic({
          job,
          connection,
          connectionId,
          chatId: channelId,
          topicKey,
          staleThreadId: 0,
          deps,
        })) ?? undefined;
    }
    if (!topicResolution.ok && resolvedThreadId === undefined) {
      return {
        ok: false,
        error: {
          code: "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING",
          message: `No Telegram forum topic is configured for ${topicKey}`,
        },
      };
    }
    const text = await formatIntegrationDeliveryMessage({
      workspaceType,
      eventType: job.eventType,
      payload: job.payload,
    });
    let media:
      | {
          readonly kind: "photo" | "document";
          readonly url?: string;
          readonly body?: Uint8Array;
          readonly contentType?: string;
          readonly fileName?: string;
          readonly caption?: string;
        }
      | undefined;
    if (
      job.provider === "telegram" &&
      job.eventType === "receipt.submitted" &&
      typeof job.payload.fileKey === "string" &&
      job.payload.fileKey.trim().length > 0
    ) {
      try {
        const mediaKind =
          job.payload.telegramMediaKind === "photo" || job.payload.telegramMediaKind === "document"
            ? job.payload.telegramMediaKind
            : resolveIntegrationMediaKindFromStorageKey(job.payload.fileKey);
        const proof = await readMemberReceiptProof({
          tenantId: job.tenantId,
          storageKey: job.payload.fileKey,
        });
        media = {
          kind: mediaKind,
          body: proof.body,
          contentType: proof.contentType,
          fileName: proof.fileName,
          caption: telegramMediaCaption(text),
        };
      } catch {
        return { ok: false, error: { code: "INTEGRATION_MEDIA_READ_FAILED" } };
      }
    } else if (
      typeof job.payload.telegramMediaUrl === "string" &&
      (job.payload.telegramMediaKind === "photo" || job.payload.telegramMediaKind === "document")
    ) {
      media = {
        kind: job.payload.telegramMediaKind,
        url: job.payload.telegramMediaUrl,
        caption: telegramMediaCaption(text),
      };
    }
    const isTourAnnouncementEvent =
      job.eventType === "TourPublished" || job.eventType === "TourAnnouncementRequested";
    const tourPdpUrl =
      job.provider === "telegram" && isTourAnnouncementEvent
        ? await (deps.resolveTourPublishedPdpUrl ?? resolveTourPublishedPdpUrl)({
            tenantId: job.tenantId,
            tourId:
              typeof job.payload.tourId === "string"
                ? job.payload.tourId
                : String(job.payload.aggregateId ?? ""),
          })
        : null;
    if (job.provider === "telegram" && isTourAnnouncementEvent && tourPdpUrl === null) {
      return { ok: false, error: { code: "INTEGRATION_TOUR_PDP_URL_UNAVAILABLE" } };
    }
    const replyMarkup =
      tourPdpUrl !== null
        ? {
            inline_keyboard: [[{ text: "مشاهده تور و ثبت‌نام", url: tourPdpUrl }]],
          }
        : job.eventType === "receipt.submitted" && typeof job.payload.receiptId === "string"
          ? {
              inline_keyboard: [
                [
                  { text: "تأیید فیش", callback_data: `receipt:approve:${job.payload.receiptId}` },
                  { text: "رد فیش", callback_data: `receipt:reject:${job.payload.receiptId}` },
                ],
              ],
            }
          : job.eventType === "registration.created" &&
              typeof job.payload.bookingId === "string" &&
              typeof job.payload.approvalRequired === "boolean"
            ? {
                inline_keyboard: [
                  [
                    {
                      text: "تأیید ثبت‌نام بدون نیاز به پرداخت",
                      // Wire code kept short — Telegram caps callback_data at 64 bytes;
                      // "registration:approve_without_payment:<uuid>" would overflow it.
                      callback_data: `registration:apr_np:${job.payload.bookingId}`,
                    },
                  ],
                  [
                    {
                      text: "تأیید ثبت‌نام؛ پرداخت لازم است",
                      callback_data: `registration:apr_wp:${job.payload.bookingId}`,
                    },
                  ],
                  ...(job.payload.approvalRequired
                    ? [
                        [
                          {
                            text: "تأیید",
                            callback_data: `registration:apr:${job.payload.bookingId}`,
                          },
                        ],
                        [
                          {
                            text: "انتقال به لیست انتظار",
                            callback_data: `registration:wl:${job.payload.bookingId}`,
                          },
                        ],
                      ]
                    : []),
                ],
              }
            : undefined;

    const result = await adapter.sendMessage(ctx, {
      channelId,
      ...(resolvedThreadId === undefined ? {} : { messageThreadId: resolvedThreadId }),
      text,
      ...(media === undefined ? {} : { media }),
      ...(replyMarkup === undefined ? {} : { replyMarkup }),
    });

    if (
      !result.ok &&
      result.errorCode === "TELEGRAM_TOPIC_THREAD_NOT_FOUND" &&
      topicKey !== null &&
      job.provider === "telegram"
    ) {
      // The stored threadId no longer resolves on Telegram's side (topic
      // deleted/invalidated) — recreate it under the same stable name and
      // retry exactly once with the fresh threadId.
      const recreatedThreadId = await autoCreateTelegramTopic({
        job,
        connection,
        connectionId,
        chatId: channelId,
        topicKey,
        staleThreadId: resolvedThreadId ?? 0,
        deps,
      });
      if (recreatedThreadId !== null) {
        const retryResult = await adapter.sendMessage(ctx, {
          channelId,
          messageThreadId: recreatedThreadId,
          text,
          ...(media === undefined ? {} : { media }),
          ...(replyMarkup === undefined ? {} : { replyMarkup }),
        });
        if (retryResult.ok) {
          logTelegramDeliverySuccess({
            job,
            connectionId,
            chatId: channelId,
            topicKey,
            threadId: recreatedThreadId,
            providerMessageId: retryResult.providerMessageId,
          });
        }
        return retryResult.ok
          ? { ok: true }
          : {
              ok: false,
              error: { code: retryResult.errorCode, message: retryResult.errorMessage },
            };
      }
    }

    if (result.ok && job.provider === "telegram") {
      logTelegramDeliverySuccess({
        job,
        connectionId,
        chatId: channelId,
        topicKey,
        threadId: resolvedThreadId,
        providerMessageId: result.providerMessageId,
      });
    }

    return result.ok
      ? { ok: true }
      : { ok: false, error: { code: result.errorCode, message: result.errorMessage } };
  }

  if (job.capability === "channel.create" && adapter.createChannelLink !== undefined) {
    const tourId =
      typeof job.payload.tourId === "string"
        ? job.payload.tourId
        : String(job.payload.aggregateId ?? "");
    const title =
      typeof job.payload.title === "string" && job.payload.title.trim().length > 0
        ? job.payload.title
        : `Tour ${tourId}`;
    const result = await adapter.createChannelLink(ctx, { title, tourId });
    return result.ok
      ? { ok: true }
      : { ok: false, error: { code: result.errorCode, message: result.errorMessage } };
  }

  return { ok: false, error: { code: "INTEGRATION_CAPABILITY_UNSUPPORTED" } };
}

export async function processIntegrationDeliveryOnce(
  deps: ProcessIntegrationDeliveryDeps,
  batchSize = readIntegrationDeliveryBatchSize()
): Promise<{
  readonly claimed: number;
  readonly done: number;
  readonly retried: number;
  readonly dead: number;
  readonly reclaimed: number;
}> {
  const reclaimed = await (
    deps.reclaimStaleProcessingJobs ?? reclaimStaleProcessingIntegrationDeliveryJobs
  )();
  const claimed = await deps.deliveryRepository.claimPendingBatch(batchSize);
  const executeJob = deps.executeJob ?? executeIntegrationDeliveryJob;
  let done = 0;
  let retried = 0;
  let dead = 0;

  for (const job of claimed) {
    let outcome: { readonly ok: boolean; readonly error?: Record<string, unknown> };
    try {
      outcome = await executeJob(job);
    } catch (error: unknown) {
      outcome = {
        ok: false,
        error: {
          code: "INTEGRATION_DELIVERY_UNHANDLED",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
    if (outcome.ok) {
      await deps.deliveryRepository.markDone(job.tenantId, job.id);
      recordIntegrationDeliverySuccess({
        tenantId: job.tenantId,
        provider: job.provider,
        capability: job.capability,
      });
      done += 1;
      continue;
    }

    const nextAttempt = job.attemptCount + 1;
    const lastError = outcome.error ?? { code: "INTEGRATION_DELIVERY_FAILED" };
    recordIntegrationDeliveryFailed({
      tenantId: job.tenantId,
      provider: job.provider,
      capability: job.capability,
      reason: deliveryFailureReason(outcome.error),
    });

    if (nextAttempt >= MAX_DELIVERY_ATTEMPTS) {
      await deps.deliveryRepository.markDead({
        tenantId: job.tenantId,
        jobId: job.id,
        lastError,
      });
      dead += 1;
      continue;
    }

    const delayMs = computeRelayBackoff({
      attempt: nextAttempt,
      baseMs: readIntegrationDeliveryBackoffBaseMs(),
      maxMs: readIntegrationDeliveryBackoffMaxMs(),
    });
    await deps.deliveryRepository.markFailedForRetry({
      tenantId: job.tenantId,
      jobId: job.id,
      attemptCount: nextAttempt,
      nextAttemptAt: new Date(Date.now() + delayMs),
      lastError,
    });
    retried += 1;
  }

  return { claimed: claimed.length, done, retried, dead, reclaimed };
}

export function readIntegrationDeliveryBatchSize(): number {
  const raw = process.env.INTEGRATION_DELIVERY_BATCH_SIZE?.trim();
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : 10;
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 50) : 10;
}

function readIntegrationDeliveryBackoffBaseMs(): number {
  const raw = process.env.INTEGRATION_DELIVERY_BACKOFF_BASE_MS?.trim();
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : 1000;
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1000;
}

function readIntegrationDeliveryBackoffMaxMs(): number {
  const base = readIntegrationDeliveryBackoffBaseMs();
  const raw = process.env.INTEGRATION_DELIVERY_BACKOFF_MAX_MS?.trim();
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : 60_000;
  return Number.isFinite(parsed) && parsed >= base ? parsed : 60_000;
}
